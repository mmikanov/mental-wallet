import { getEmbedUrl, getEmbedOrigin } from '../embedUtils';

describe('getEmbedUrl', () => {
  describe('YouTube', () => {
    it('converts standard watch URL', () => {
      expect(getEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'))
        .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('converts short youtu.be URL', () => {
      expect(getEmbedUrl('https://youtu.be/dQw4w9WgXcQ', 'youtube'))
        .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('converts shorts URL', () => {
      expect(getEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube'))
        .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('converts embed URL (already embedded format)', () => {
      expect(getEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube'))
        .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('handles URL with extra query params', () => {
      expect(getEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120', 'youtube'))
        .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('returns original URL if video ID cannot be extracted', () => {
      const url = 'https://www.youtube.com/channel/UC12345';
      expect(getEmbedUrl(url, 'youtube')).toBe(url);
    });

    it('handles video ID with hyphens and underscores', () => {
      expect(getEmbedUrl('https://youtu.be/Ab_C-d1E_fG', 'youtube'))
        .toBe('https://www.youtube.com/embed/Ab_C-d1E_fG');
    });
  });

  describe('Vimeo', () => {
    it('converts standard vimeo URL', () => {
      expect(getEmbedUrl('https://vimeo.com/123456789', 'vimeo'))
        .toBe('https://player.vimeo.com/video/123456789');
    });

    it('converts www.vimeo URL', () => {
      expect(getEmbedUrl('https://www.vimeo.com/987654321', 'vimeo'))
        .toBe('https://player.vimeo.com/video/987654321');
    });

    it('returns original URL if video ID cannot be extracted', () => {
      const url = 'https://vimeo.com/channels/staffpicks';
      expect(getEmbedUrl(url, 'vimeo')).toBe(url);
    });
  });

  describe('SoundCloud', () => {
    it('converts SoundCloud URL to widget player URL', () => {
      const url = 'https://soundcloud.com/artist/track-name';
      expect(getEmbedUrl(url, 'soundcloud'))
        .toBe(`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false`);
    });

    it('encodes special characters in URL', () => {
      const url = 'https://soundcloud.com/artist/track name&special';
      const result = getEmbedUrl(url, 'soundcloud');
      expect(result).toContain(encodeURIComponent(url));
      expect(result).toContain('auto_play=false');
    });
  });

  describe('Spotify', () => {
    it('converts track URL', () => {
      expect(getEmbedUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'spotify'))
        .toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
    });

    it('converts album URL', () => {
      expect(getEmbedUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3', 'spotify'))
        .toBe('https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3');
    });

    it('converts playlist URL', () => {
      expect(getEmbedUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', 'spotify'))
        .toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M');
    });

    it('converts episode URL', () => {
      expect(getEmbedUrl('https://open.spotify.com/episode/1a2B3c4D5e6F7g8H9i0J', 'spotify'))
        .toBe('https://open.spotify.com/embed/episode/1a2B3c4D5e6F7g8H9i0J');
    });

    it('handles URL with query params', () => {
      expect(getEmbedUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123', 'spotify'))
        .toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
    });

    it('returns original URL if format not recognized', () => {
      const url = 'https://open.spotify.com/user/someuser';
      expect(getEmbedUrl(url, 'spotify')).toBe(url);
    });
  });

  describe('Unknown platform', () => {
    it('returns the original URL unchanged', () => {
      const url = 'https://bandcamp.com/album/something';
      expect(getEmbedUrl(url, 'unknown')).toBe(url);
    });

    it('returns any arbitrary URL unchanged', () => {
      const url = 'https://example.com/media/player?id=123';
      expect(getEmbedUrl(url, 'unknown')).toBe(url);
    });
  });
});

describe('getEmbedOrigin', () => {
  it('extracts origin from YouTube embed URL', () => {
    expect(getEmbedOrigin('https://www.youtube.com/embed/abc123'))
      .toBe('https://www.youtube.com');
  });

  it('extracts origin from Spotify embed URL', () => {
    expect(getEmbedOrigin('https://open.spotify.com/embed/track/123'))
      .toBe('https://open.spotify.com');
  });

  it('extracts origin from Vimeo embed URL', () => {
    expect(getEmbedOrigin('https://player.vimeo.com/video/123'))
      .toBe('https://player.vimeo.com');
  });

  it('extracts origin from SoundCloud widget URL', () => {
    expect(getEmbedOrigin('https://w.soundcloud.com/player/?url=test'))
      .toBe('https://w.soundcloud.com');
  });

  it('returns empty string for invalid URL', () => {
    expect(getEmbedOrigin('not-a-url')).toBe('');
  });
});

import { getEmbedHtml } from '../embedUtils';

describe('getEmbedHtml', () => {
  it('returns HTML wrapper for YouTube with referrerpolicy', () => {
    const html = getEmbedHtml('https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube');
    expect(html).not.toBeNull();
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(html).toContain('src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('<meta name="referrer" content="strict-origin-when-cross-origin">');
  });

  it('returns HTML wrapper for Vimeo with referrerpolicy', () => {
    const html = getEmbedHtml('https://player.vimeo.com/video/123456', 'vimeo');
    expect(html).not.toBeNull();
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(html).toContain('src="https://player.vimeo.com/video/123456"');
  });

  it('returns null for Spotify (direct URL loading works)', () => {
    expect(getEmbedHtml('https://open.spotify.com/embed/track/123', 'spotify')).toBeNull();
  });

  it('returns null for SoundCloud (direct URL loading works)', () => {
    expect(getEmbedHtml('https://w.soundcloud.com/player/?url=test', 'soundcloud')).toBeNull();
  });

  it('returns null for unknown platforms', () => {
    expect(getEmbedHtml('https://example.com/video', 'unknown')).toBeNull();
  });
});
