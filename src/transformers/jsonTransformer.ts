import { ResponseTransformer } from './responseTransformer';

export const jsonTransformer: ResponseTransformer = (data: any) => {
  if (data && typeof data === 'object') {
    data.transformed = true;
  }
  return data;
};
