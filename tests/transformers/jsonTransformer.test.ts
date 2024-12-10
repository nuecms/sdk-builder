import { describe, it, expect } from 'vitest';
import { jsonTransformer } from '../../src/transformers/jsonTransformer';

describe('jsonResponseTransformer', () => {
  it('should uppercase the user name in JSON format', () => {
    const mockData = {
      user: {
        id: '123',
        name: 'john doe',
      },
    };

    const transformedData = jsonTransformer(mockData, 'json');

    expect(transformedData.user.name).toBe('john doe');
  });

  it('should return unmodified data for non-JSON formats', () => {
    const mockData = '<user><id>123</id><name>john doe</name></user>';

    const transformedData = jsonTransformer(mockData, 'xml');

    expect(transformedData).toBe(mockData);
  });
});
