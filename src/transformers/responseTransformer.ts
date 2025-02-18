export type ResponseTransformer<F> = (data: any, options: F, response: Response) => any;
