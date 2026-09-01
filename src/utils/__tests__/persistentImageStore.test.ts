import { persistPickedImage, resolveImageUri } from '../persistentImageStore';

// --- Mock the modern expo-file-system API (File / Directory / Paths) ---
const mockCopy = jest.fn();
const mockCreate = jest.fn();

let mockDirExists = true;

// Track constructed File instances so we can assert copy targets.
const constructedFiles: Array<{ segments: unknown[]; uri: string }> = [];

jest.mock('expo-file-system', () => {
  class Directory {
    segments: unknown[];
    constructor(...segments: unknown[]) {
      this.segments = segments;
    }
    get exists() {
      return mockDirExists;
    }
    create(opts?: unknown) {
      mockCreate(opts);
    }
  }
  class File {
    segments: unknown[];
    uri: string;
    constructor(...segments: unknown[]) {
      this.segments = segments;
      // Build a deterministic uri: join string-ish segments.
      const parts = segments.map((s: any) =>
        typeof s === 'string' ? s : s?.__docDir ? 'file:///DOCS' : String(s?.uri ?? '')
      );
      this.uri = parts.join('/').replace('file:///DOCS/', 'file:///DOCS/');
      constructedFiles.push({ segments, uri: this.uri });
    }
    copy(dest: unknown) {
      mockCopy(this, dest);
    }
  }
  const Paths = {
    get document() {
      return { __docDir: true, uri: 'file:///DOCS' };
    },
  };
  return { File, Directory, Paths };
});

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

describe('persistPickedImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDirExists = true;
    constructedFiles.length = 0;
  });

  it('returns a path relative to the document directory', async () => {
    const rel = await persistPickedImage('file:///tmp/pic.jpg');
    expect(rel).toBe('media/attachments/test-uuid-1234.jpg');
    expect(rel.startsWith('/')).toBe(false);
    expect(rel).not.toContain('file://');
  });

  it('copies the source file into the persistent directory', async () => {
    await persistPickedImage('file:///tmp/pic.png');
    expect(mockCopy).toHaveBeenCalledTimes(1);
  });

  it('creates the attachments directory when missing', async () => {
    mockDirExists = false;
    await persistPickedImage('file:///tmp/pic.jpg');
    expect(mockCreate).toHaveBeenCalledWith({ intermediates: true, idempotent: true });
  });

  it('does not re-create the directory when it already exists', async () => {
    mockDirExists = true;
    await persistPickedImage('file:///tmp/pic.jpg');
    expect(mockCreate).not.toHaveBeenCalled();
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
  it('re-anchors a relative path to the current document directory', () => {
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
