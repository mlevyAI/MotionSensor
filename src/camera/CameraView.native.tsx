// Native camera adapter placeholder (future iOS build).
// Intentionally a stub: the native port will implement this with
// react-native-vision-camera frame processors, satisfying the same
// CameraViewProps / CameraHandle contract as the web adapter.
import React, { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { CameraHandle, CameraViewProps } from './types';

function CameraViewNative(_props: CameraViewProps, _ref: React.Ref<CameraHandle>) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <Text style={{ color: '#fff', padding: 24, textAlign: 'center' }}>
        Native camera (VisionCamera) not yet implemented. This build targets web/PWA.
      </Text>
    </View>
  );
}

export const CameraView = forwardRef<CameraHandle, CameraViewProps>(CameraViewNative);
