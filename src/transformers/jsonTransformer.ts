import { ResponseTransformer } from './responseTransformer';

export const jsonTransformer: ResponseTransformer<any> = (data: any, options: any, response: any) => {
  if (data && typeof data === 'object') {
    data.transformed = true;
  }
  return data;
};
