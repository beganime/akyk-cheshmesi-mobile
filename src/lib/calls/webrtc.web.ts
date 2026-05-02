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
  constructor() {
    throw new Error('WebRTC звонки доступны только в Android/iOS приложении');
  }
}

export class RTCIceCandidate {
  candidate: any;

  constructor(candidate: any) {
    this.candidate = candidate;
  }
}

export class RTCSessionDescription {
  description: any;

  constructor(description: any) {
    this.description = description;
  }
}

export function RTCView() {
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