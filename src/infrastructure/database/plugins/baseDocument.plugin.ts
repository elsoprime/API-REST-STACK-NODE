import { type Schema } from 'mongoose';

type PlainDocument = Record<string, unknown> & {
  _id?: { toString: () => string } | string;
  id?: string;
};

function normalizeDocument(document: PlainDocument): PlainDocument {
  const normalizedDocument = { ...document };

  if (normalizedDocument._id) {
    normalizedDocument.id =
      typeof normalizedDocument._id === 'string'
        ? normalizedDocument._id
        : normalizedDocument._id.toString();
    delete normalizedDocument._id;
  }

  return normalizedDocument;
}

export function baseDocumentPlugin<TDocument>(schema: Schema<TDocument>): void {
  const transformDocument = (_doc: unknown, ret: unknown) =>
    normalizeDocument(ret as PlainDocument);

  schema.set('timestamps', true);
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: transformDocument
  });
  schema.set('toObject', {
    virtuals: true,
    versionKey: false,
    transform: transformDocument
  });
}
