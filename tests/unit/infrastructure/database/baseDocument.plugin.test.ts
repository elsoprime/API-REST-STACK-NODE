import mongoose, { Schema, model, models } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

describe('baseDocumentPlugin', () => {
  it('enables timestamps and normalizes serialized identifiers', () => {
    const schema = new Schema({
      name: {
        type: String,
        required: true
      }
    });

    baseDocumentPlugin(schema);

    const modelName = 'BaseDocumentPluginSpecModel';
    const PluginModel =
      (models[modelName] as mongoose.Model<{ name: string }> | undefined) ??
      model(modelName, schema);
    const document = new PluginModel({ name: 'demo' });
    const serializedDocument = document.toJSON() as Record<string, unknown>;

    expect(schema.get('timestamps')).toBe(true);
    expect(serializedDocument.id).toBeDefined();
    expect(serializedDocument._id).toBeUndefined();
    expect(serializedDocument.__v).toBeUndefined();
  });
});
