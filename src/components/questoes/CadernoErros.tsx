import React from 'react';
import { CadernoErrosView, CadernoErrosViewProps } from './CadernoErrosView';

export { CadernoErrosView, MOTIVOS_CONFIG } from './CadernoErrosView';
export type { CadernoErrosViewProps } from './CadernoErrosView';

export const CadernoErros: React.FC<CadernoErrosViewProps> = (props) => {
  return <CadernoErrosView {...props} />;
};

export default CadernoErros;
