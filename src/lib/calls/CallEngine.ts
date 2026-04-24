import InCallManager from 'react-native-incall-manager';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  registerGlobals,
  type MediaStream,
  type MediaStreamTrack,
} from 'react-native-webrtc';

import { ENV } from '@/src/config/env';
import {
  acceptCall,
  cancelCall,
  createChatCall,
  endCall,
  rejectCall,
} from '@/src/lib/api/calls';
import { getAccessToken } from '@/src/lib/storage/secure';
import type {
  CallSession,
  CallSocketEvent,
  CallType,
} from '@/src/types/calls';

type Listener = (state: CallEngineState) => void;

export type CallEngineStatus =
  | 'idle'
  | 'starting'
  | 'connecting'
  | 'joined'
  | 'ended'
  | 'error';

export type CallEngineState = {
  status: CallEngineStatus;
  call: CallSession | null;
  callType: CallType | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  speakerOn: boolean;
  videoEnabled: boolean;
  error: string | null;
  socketConnected: boolean;
};

type JoinSocketResponse = {
  peerId: string | null;
};

function appendToken(url: string, token: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

function createInitialState(): CallEngineState {
  return {
    status: 'idle',
    call: null,
    callType: null,
    localStream: null,
    remoteStream: null,
    muted: false,
    speakerOn: false,
    videoEnabled: true,
    error: null,
    socketConnected: false,
  };
}

class CallEngine {
  private state: CallEngineState = createInitialState();
  private listeners = new Set<Listener>();

  private socket: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;

  private joined = false;
  private makingOffer = false;
  private ignoreOffer = false;

  constructor() {
    try {
      registerGlobals();
    } catch {
      // ignore
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState() {
    return this.state;
  }

  private setState(
    patch:
      | Partial<CallEngineState>
      | ((current: CallEngineState) => Partial<CallEngineState>),
  ) {
    const nextPatch = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = {
      ...this.state,
      ...nextPatch,
    };

    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        console.error('CallEngine listener error:', error);
      }
    }
  }

  private async createLocalStream(callType: CallType) {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video:
        callType === 'video'
          ? {
              facingMode: 'user',
              width: 640,
              height: 360,
              frameRate: 24,
            }
          : false,
    });

    return stream;
  }

  private async createPeerConnection(callType: CallType) {
    const pc = new RTCPeerConnection({
      iceServers: ENV.CALL_ICE_SERVERS as any,
      iceCandidatePoolSize: 10,
    });

    const pcAny = pc as any;

    pcAny.onicecandidate = (event: any) => {
      if (!event?.candidate || !this.state.call) {
        return;
      }

      this.sendSocketMessage({
        type: 'call_ice',
        chat_uuid: this.state.call.chat_uuid,
        call_uuid: this.state.call.uuid,
        room_key: this.state.call.room_key,
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        },
      });
    };

    pcAny.ontrack = (event: any) => {
      const firstStream = event?.streams?.[0] ?? null;
      if (!firstStream) {
        return;
      }

      this.setState({
        remoteStream: firstStream,
      });
    };

    pcAny.onconnectionstatechange = () => {
      const state = pcAny.connectionState;

      if (state === 'connected') {
        this.setState({
          status: 'joined',
        });
      }

      if (state === 'failed' || state === 'disconnected') {
        this.setState({
          status: 'error',
          error: 'Соединение звонка прервано',
        });
      }

      if (state === 'closed') {
        this.setState({
          status: 'ended',
        });
      }
    };

    pcAny.onnegotiationneeded = async () => {
      if (!this.joined) {
        return;
      }

      await this.createAndSendOffer();
    };

    const localStream = await this.createLocalStream(callType);

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    this.pc = pc;
    this.setState({
      localStream,
      callType,
      speakerOn: callType === 'video',
      videoEnabled: callType === 'video',
      muted: false,
    });

    InCallManager.start({ media: callType === 'video' ? 'video' : 'audio' });
    InCallManager.setForceSpeakerphoneOn(callType === 'video');
    InCallManager.setMicrophoneMute(false);

    return pc;
  }

  private async connectSocket(): Promise<WebSocket> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Нет access token для звонка');
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(appendToken(ENV.CALL_WS_BASE_URL, token));
      let settled = false;

      ws.onopen = () => {
        this.socket = ws;
        this.setState({ socketConnected: true });
        settled = true;
        resolve(ws);
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error('Не удалось открыть сокет звонка'));
        }
      };

      ws.onclose = () => {
        this.setState({ socketConnected: false });
        this.socket = null;
      };

      ws.onmessage = async (event) => {
        try {
          const parsed = JSON.parse(event.data) as CallSocketEvent;
          await this.handleSocketEvent(parsed);
        } catch (error) {
          console.error('CallEngine socket parse error:', error);
        }
      };
    });
  }

  private async waitForJoin(
    ws: WebSocket,
    call: CallSession,
  ): Promise<JoinSocketResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Таймаут входа в комнату звонка'));
      }, 15000);

      ws.onmessage = async (event) => {
        try {
          const parsed = JSON.parse(event.data) as CallSocketEvent & {
            peer_id?: string;
          };

          if (parsed.type === 'joined_call') {
            clearTimeout(timeout);
            this.joined = true;

            ws.onmessage = async (nextEvent) => {
              try {
                const nextParsed = JSON.parse(nextEvent.data) as CallSocketEvent;
                await this.handleSocketEvent(nextParsed);
              } catch (error) {
                console.error('CallEngine socket event error:', error);
              }
            };

            resolve({
              peerId: parsed.peer_id ?? null,
            });
            return;
          }

          if (parsed.type === 'error') {
            clearTimeout(timeout);
            reject(
              new Error(
                String(parsed.payload?.detail || 'Ошибка входа в комнату звонка'),
              ),
            );
            return;
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      ws.send(
        JSON.stringify({
          type: 'join_call',
          chat_uuid: call.chat_uuid,
          call_uuid: call.uuid,
          room_key: call.room_key,
        }),
      );
    });
  }

  private sendSocketMessage(payload: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private async createAndSendOffer() {
    if (!this.pc || !this.state.call || this.makingOffer) {
      return;
    }

    this.makingOffer = true;

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.sendSocketMessage({
        type: 'call_offer',
        chat_uuid: this.state.call.chat_uuid,
        call_uuid: this.state.call.uuid,
        room_key: this.state.call.room_key,
        sdp: offer.sdp,
        sdp_type: 'offer',
      });
    } catch (error) {
      console.error('createAndSendOffer error:', error);
      this.setState({
        status: 'error',
        error: 'Не удалось создать offer для звонка',
      });
    } finally {
      this.makingOffer = false;
    }
  }

  private async handleSocketEvent(event: CallSocketEvent) {
    if (!this.pc || !this.state.call) {
      return;
    }

    switch (event.type) {
      case 'call_answer': {
        if (!event.sdp) {
          return;
        }

        await this.pc.setRemoteDescription(
          new RTCSessionDescription({
            type: 'answer',
            sdp: event.sdp,
          }),
        );

        this.setState({
          status: 'joined',
        });
        return;
      }

      case 'call_offer': {
        if (!event.sdp) {
          return;
        }

        const polite = true;

        if (!polite && (this.makingOffer || (this.pc as any).signalingState !== 'stable')) {
          this.ignoreOffer = true;
          return;
        }

        this.ignoreOffer = false;

        await this.pc.setRemoteDescription(
          new RTCSessionDescription({
            type: 'offer',
            sdp: event.sdp,
          }),
        );

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        this.sendSocketMessage({
          type: 'call_answer',
          chat_uuid: this.state.call.chat_uuid,
          call_uuid: this.state.call.uuid,
          room_key: this.state.call.room_key,
          sdp: answer.sdp,
          sdp_type: 'answer',
        });

        this.setState({
          status: 'joined',
        });
        return;
      }

      case 'call_ice': {
        if (!event.candidate || this.ignoreOffer) {
          return;
        }

        try {
          await this.pc.addIceCandidate(
            new RTCIceCandidate({
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid ?? undefined,
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? undefined,
            } as any),
          );
        } catch (error) {
          console.error('addIceCandidate error:', error);
        }
        return;
      }

      case 'call_peer_left': {
        return;
      }

      case 'error': {
        this.setState({
          status: 'error',
          error: String(event.payload?.detail || 'Ошибка звонка'),
        });
        return;
      }

      default:
        return;
    }
  }

  async startOutgoing(chatUuid: string, callType: CallType) {
    await this.cleanup(false);

    this.setState({
      status: 'starting',
      error: null,
      call: null,
      remoteStream: null,
      localStream: null,
      callType,
    });

    const created = await createChatCall(chatUuid, {
      call_type: callType,
      metadata: {
        device_platform: 'mobile',
        device_name: 'Akyl Cheshmesi Mobile',
      },
    });

    this.setState({
      call: created,
      status: 'connecting',
    });

    await this.createPeerConnection(callType);

    const ws = await this.connectSocket();
    await this.waitForJoin(ws, created);
    await this.createAndSendOffer();

    return created;
  }

  async acceptIncoming(call: CallSession) {
    await this.cleanup(false);

    this.setState({
      status: 'starting',
      error: null,
      call,
      remoteStream: null,
      localStream: null,
      callType: call.call_type,
    });

    const accepted = await acceptCall(call.uuid, {
      device_platform: 'mobile',
      device_name: 'Akyl Cheshmesi Mobile',
    });

    this.setState({
      call: accepted,
      status: 'connecting',
    });

    await this.createPeerConnection(accepted.call_type);

    const ws = await this.connectSocket();
    await this.waitForJoin(ws, accepted);

    return accepted;
  }

  async rejectIncoming(callUuid: string) {
    await rejectCall(callUuid);
    await this.cleanup(false);
  }

  async cancelOutgoing(callUuid: string) {
    await cancelCall(callUuid);
    await this.cleanup(true);
  }

  async endCurrent() {
    const currentCall = this.state.call;

    if (this.socket && currentCall) {
      this.sendSocketMessage({
        type: 'leave_call',
        chat_uuid: currentCall.chat_uuid,
        call_uuid: currentCall.uuid,
        room_key: currentCall.room_key,
      });
    }

    if (currentCall?.uuid) {
      try {
        await endCall(currentCall.uuid);
      } catch (error) {
        console.error('endCurrent api error:', error);
      }
    }

    await this.cleanup(true);
  }

  async setMuted(nextMuted: boolean) {
    const stream = this.state.localStream;
    if (!stream) return;

    stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = !nextMuted;
    });

    InCallManager.setMicrophoneMute(nextMuted);

    this.setState({
      muted: nextMuted,
    });
  }

  async setSpeakerOn(nextSpeakerOn: boolean) {
    InCallManager.setForceSpeakerphoneOn(nextSpeakerOn);

    this.setState({
      speakerOn: nextSpeakerOn,
    });
  }

  async setVideoEnabled(nextEnabled: boolean) {
    const stream = this.state.localStream;
    if (!stream) return;

    stream.getVideoTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = nextEnabled;
    });

    this.setState({
      videoEnabled: nextEnabled,
    });
  }

  async switchCamera() {
    const stream = this.state.localStream;
    if (!stream) return;

    const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
      _switchCamera?: () => void;
    };

    if (track && typeof track._switchCamera === 'function') {
      track._switchCamera();
    }
  }

  async cleanup(markEnded: boolean) {
    this.joined = false;
    this.ignoreOffer = false;
    this.makingOffer = false;

    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }

    if (this.state.localStream) {
      this.state.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
    }

    if (this.state.remoteStream) {
      this.state.remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
    }

    InCallManager.stop();

    this.setState({
      ...createInitialState(),
      status: markEnded ? 'ended' : 'idle',
    });
  }
}

export const callEngine = new CallEngine();