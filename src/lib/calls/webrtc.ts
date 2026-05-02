import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type MediaStream = any;
export type MediaStreamTrack = any;

export function registerGlobals() {
  return undefined;
}

export const mediaDevices = {
  async getUserMedia() {
    throw new Error('Звонки доступны только в Android/iOS приложении');
  },
};

export class RTCPeerConnection {
  [key: string]: any;

  constructor(_config?: any) {
    throw new Error('WebRTC звонки доступны только в Android/iOS приложении');
  }

  addTrack(_track: any, _stream: any) {
    return undefined;
  }

  async createOffer() {
    return {};
  }

  async createAnswer() {
    return {};
  }

  async setLocalDescription(_description: any) {
    return undefined;
  }

  async setRemoteDescription(_description: any) {
    return undefined;
  }

  async addIceCandidate(_candidate: any) {
    return undefined;
  }

  close() {
    return undefined;
  }
}

export class RTCIceCandidate {
  [key: string]: any;

  constructor(candidate: any) {
    Object.assign(this, candidate);
  }
}

export class RTCSessionDescription {
  [key: string]: any;

  constructor(description: any) {
    Object.assign(this, description);
  }
}

export function RTCView(_props: any) {
  return React.createElement(
    View,
    { style: styles.container },
    React.createElement(
      Text,
      { style: styles.text },
      'Видео доступно только в мобильном приложении',
    ),
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});