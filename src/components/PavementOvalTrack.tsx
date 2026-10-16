import React from 'react';
import DirtOvalTrack, { type DirtOvalTrackProps } from './DirtOvalTrack';
export default function PavementOvalTrack(props: Omit<DirtOvalTrackProps, 'surface'>) {
  return <DirtOvalTrack {...props} surface="asphalt" />;
}
