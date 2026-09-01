import { persistPickedImage, resolveImageUri } from '../persistentImageStore';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///DOCS/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

import * as FileSystem from 'expo-file-system';

describe('persistPickedImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
  });

  it('returns a path relative to documentDirectory', async () => {
    const rel = await persistPickedImage('file:///tmp/pic.jpg');
    expect(rel).toBe('media/attachments/test-uuid-1234.jpg');
    expect(rel.startsWith('/')).toBe(false);
    expect(rel).not.toContain('file://');
  });

  it('copies from source to the persistent destination', async () => {
    await persistPickedImage('file:///tmp/pic.png');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/pic.png',
      to: 'file:///DOCS/media/attachments/test-uuid-1234.png',
    });
  });

  it('creates the attachments directory if missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    await persistPickedImage('file:///tmp/pic.jpg');
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///DOCS/media/attachments/',
      { intermediates: true }
    );
  });

  it('strips query strings from the extension', async () => {
    const rel = await persistPickedImage('file:///tmp/pic.jpg?width=100');
    expect(rel).toBe('media/attachments/test-uuid-1234.jpg');
  });

  it('falls back to jpg for extension-less URIs', async () => {
    const rel = await persistPickedImage('file:///tmp/IMG_0001');
    expect(rel).toBe('media/attachments/test-uuid-1234.jpg');
  });
});

describe('resolveImageUri', () => {
  it('re-anchors a relative path to the current documentDirectory', () => {
    expect(resolveImageUri('media/attachments/abc.jpg')).toBe(
      'file:///DOCS/media/attachments/abc.jpg'
    );
  });

  it('passes through http URLs unchanged', () => {
    expect(resolveImageUri('https://example.com/x.jpg')).toBe('https://example.com/x.jpg');
  });

  it('passes through file:// URIs unchanged', () => {
    expect(resolveImageUri('file:///tmp/x.jpg')).toBe('file:///tmp/x.jpg');
  });

  it('passes through content:// URIs unchanged (legacy Android)', () => {
    expect(resolveImageUri('content://media/1')).toBe('content://media/1');
  });

  it('passes through ph:// URIs unchanged (legacy iOS)', () => {
    expect(resolveImageUri('ph://asset-id')).toBe('ph://asset-id');
  });

  it('passes through legacy absolute sandbox paths unchanged', () => {
    const legacy = '/var/mobile/Containers/Data/Application/UUID/tmp/x.jpg';
    expect(resolveImageUri(legacy)).toBe(legacy);
  });

  it('returns empty string unchanged', () => {
    expect(resolveImageUri('')).toBe('');
  });
});
