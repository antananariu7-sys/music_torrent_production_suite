import { parseTracksFromText, parseTracksFromCue, extractFormatInfo, parseAlbumsFromHtml } from './torrentPageParser'

describe('torrentPageParser', () => {
  describe('parseTracksFromText', () => {
    it('should parse numbered track list', () => {
      const text = `
        1. Музыка драчёвых напильников
        2. Аборт
        3. Мы идём пить квас
        4. Завтра будет тот же день
        5. Московский вокзал
      `

      const tracks = parseTracksFromText(text)

      expect(tracks).toHaveLength(5)
      expect(tracks[0]).toEqual({ position: 1, title: 'Музыка драчёвых напильников', duration: undefined })
      expect(tracks[4]).toEqual({ position: 5, title: 'Московский вокзал', duration: undefined })
    })

    it('should handle tracks with durations', () => {
      const text = `
        1. Track One (3:45)
        2. Track Two (10:02)
      `

      const tracks = parseTracksFromText(text)

      expect(tracks).toHaveLength(2)
      expect(tracks[0].duration).toBe('3:45')
      expect(tracks[1].duration).toBe('10:02')
    })

    it('should ignore non-track lines', () => {
      const text = `
        Год издания: 1997
        Издатель: Label
        Треклист:
        1. First Track
        2. Second Track
        Some random text
      `

      const tracks = parseTracksFromText(text)

      expect(tracks).toHaveLength(2)
      expect(tracks[0].title).toBe('First Track')
    })

    it('should handle multi-CD track lists', () => {
      const text = `
        CD1. Album One
        1. Track A
        2. Track B
        CD2. Album Two
        1. Track C
        2. Track D
      `

      const tracks = parseTracksFromText(text)

      // Should parse all numbered tracks
      expect(tracks).toHaveLength(4)
      expect(tracks[0].title).toBe('Track A')
      expect(tracks[2].title).toBe('Track C')
    })

    it('should return empty array for text without tracks', () => {
      const text = 'Just some random description text'
      expect(parseTracksFromText(text)).toHaveLength(0)
    })
  })

  describe('parseTracksFromCue', () => {
    it('should extract track titles from CUE content', () => {
      const cue = `
PERFORMER "Ноль"
TITLE "Музыка драчевых напильников"
FILE "Ноль - Музыка драчевых напильников.flac" WAVE
  TRACK 01 AUDIO
    TITLE "Музыка драчёвых напильников"
    PERFORMER "Ноль"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Аборт"
    PERFORMER "Ноль"
    INDEX 01 04:42:05
  TRACK 03 AUDIO
    TITLE "Мы идём пить квас"
    PERFORMER "Ноль"
    INDEX 01 07:45:25
      `

      const tracks = parseTracksFromCue(cue)

      expect(tracks).toHaveLength(3)
      expect(tracks[0]).toEqual({ position: 1, title: 'Музыка драчёвых напильников' })
      expect(tracks[1]).toEqual({ position: 2, title: 'Аборт' })
      expect(tracks[2]).toEqual({ position: 3, title: 'Мы идём пить квас' })
    })

    it('should skip placeholder titles', () => {
      const cue = `
  TRACK 01 AUDIO
    TITLE "Good Track"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "-"
    INDEX 01 05:00:00
      `

      const tracks = parseTracksFromCue(cue)

      expect(tracks).toHaveLength(1)
      expect(tracks[0].title).toBe('Good Track')
    })

    it('should return empty for non-CUE content', () => {
      const text = 'This is not a CUE sheet'
      expect(parseTracksFromCue(text)).toHaveLength(0)
    })
  })

  describe('extractFormatInfo', () => {
    it('should detect FLAC format', () => {
      const html = '<title>(Rock) Artist - Album - FLAC (image+.cue), lossless</title>'
      const info = extractFormatInfo(html)

      expect(info.format).toBe('FLAC')
      expect(info.bitrate).toBe('lossless')
    })

    it('should detect MP3 with bitrate', () => {
      const html = '<title>(Rock) Artist - Album - MP3, 320 kbps</title>'
      const info = extractFormatInfo(html)

      expect(info.format).toBe('MP3')
      expect(info.bitrate).toBe('320 kbps')
    })

    it('should detect WAV format', () => {
      const html = '<title>(Rock) Artist - Album - WAV</title>'
      const info = extractFormatInfo(html)

      expect(info.format).toBe('WAV')
      expect(info.bitrate).toBe('lossless')
    })

    it('should return empty for unknown format', () => {
      const html = '<title>Some Page</title>'
      const info = extractFormatInfo(html)

      expect(info.format).toBeUndefined()
      expect(info.bitrate).toBeUndefined()
    })
  })

  describe('parseAlbumsFromHtml', () => {
    it('should parse discography page with sp-wrap sections', () => {
      const html = `
        <html>
          <title>(Rock) [CD] Artist - Дискография (53 CD) - 1986-2020, FLAC (image+.cue), lossless :: RuTracker.org</title>
          <body>
            <div class="post_body" id="p-123">
              <span class="post-b">Аудиокодек</span>: FLAC (*.flac)<br>
              <span class="post-b">Продолжительность</span>: 48:24:56<br>
              <div class="sp-wrap">
                <div class="sp-head folded"><span>1986. Ноль - Музыка драчевых напильников</span></div>
                <div class="sp-body">
                  <span class="post-b">Год издания</span>: 1997<br>
                  <span class="post-b">Треклист</span>:<br>
                  1. Музыка драчёвых напильников<br>
                  2. Аборт<br>
                  3. Мы идём пить квас<br>
                  <div class="sp-wrap">
                    <div class="sp-head folded"><span>Лог создания рипа</span></div>
                    <div class="sp-body"><pre class="post-pre">EAC log content</pre></div>
                  </div>
                </div>
              </div>
              <div class="sp-wrap">
                <div class="sp-head folded"><span>1988. Ноль - Склад ума</span></div>
                <div class="sp-body">
                  <span class="post-b">Треклист</span>:<br>
                  1. Track A<br>
                  2. Track B<br>
                </div>
              </div>
            </div>
          </body>
        </html>
      `

      const result = parseAlbumsFromHtml(html)

      expect(result.albums).toHaveLength(2)
      expect(result.albums[0].title).toBe('Музыка драчевых напильников')
      expect(result.albums[0].year).toBe('1986')
      expect(result.albums[0].tracks).toHaveLength(3)
      expect(result.albums[0].tracks[0].title).toBe('Музыка драчёвых напильников')

      expect(result.albums[1].title).toBe('Склад ума')
      expect(result.albums[1].year).toBe('1988')
      expect(result.albums[1].tracks).toHaveLength(2)

      expect(result.format).toBe('FLAC')
      expect(result.bitrate).toBe('lossless')
      expect(result.totalDuration).toBe('48:24:56')
    })

    it('should skip log and CUE sheet sp-wrap sections', () => {
      const html = `
        <html>
          <body>
            <div class="post_body" id="p-123">
              <div class="sp-wrap">
                <div class="sp-head folded"><span>1986. Album Title</span></div>
                <div class="sp-body">
                  1. Track One<br>
                </div>
              </div>
              <div class="sp-wrap">
                <div class="sp-head folded"><span>Лог создания рипа</span></div>
                <div class="sp-body"><pre class="post-pre">log</pre></div>
              </div>
              <div class="sp-wrap">
                <div class="sp-head folded"><span>Содержание индексной карты (.CUE)</span></div>
                <div class="sp-body"><pre class="post-pre">cue</pre></div>
              </div>
            </div>
          </body>
        </html>
      `

      const result = parseAlbumsFromHtml(html)
      expect(result.albums).toHaveLength(1)
      expect(result.albums[0].title).toBe('Album Title')
    })

    it('should fall back to CUE parsing when no numbered tracks found', () => {
      const html = `
        <html>
          <body>
            <div class="post_body" id="p-123">
              <div class="sp-wrap">
                <div class="sp-head folded"><span>2020. Artist - Album</span></div>
                <div class="sp-body">
                  No numbered tracks here, just description
                  <div class="sp-wrap">
                    <div class="sp-head folded"><span>Содержание индексной карты (.CUE)</span></div>
                    <div class="sp-body">
                      <pre class="post-pre">
PERFORMER "Artist"
TITLE "Album"
FILE "Artist - Album.flac" WAVE
  TRACK 01 AUDIO
    TITLE "First Song"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Second Song"
    INDEX 01 04:00:00
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `

      const result = parseAlbumsFromHtml(html)
      expect(result.albums).toHaveLength(1)
      expect(result.albums[0].tracks).toHaveLength(2)
      expect(result.albums[0].tracks[0].title).toBe('First Song')
      expect(result.albums[0].tracks[1].title).toBe('Second Song')
    })

    it('should handle single album page with tracks in post_body', () => {
      const html = `
        <html>
          <title>(Rock) Artist - Album Name - 2020, FLAC :: RuTracker.org</title>
          <body>
            <div class="post_body" id="p-123">
              <span class="post-b">Аудиокодек</span>: FLAC<br>
              <span class="post-b">Треклист</span>:<br>
              1. First Track<br>
              2. Second Track<br>
              3. Third Track<br>
            </div>
          </body>
        </html>
      `

      const result = parseAlbumsFromHtml(html)
      expect(result.albums).toHaveLength(1)
      expect(result.albums[0].tracks).toHaveLength(3)
      expect(result.albums[0].title).toContain('Artist - Album Name')
    })

    it('should handle pages with no track listing', () => {
      const html = `
        <html>
          <title>Some Page :: RuTracker.org</title>
          <body>
            <div class="post_body" id="p-123">
              Just some description text with no tracks
            </div>
          </body>
        </html>
      `

      const result = parseAlbumsFromHtml(html)
      expect(result.albums).toHaveLength(0)
    })

    it('should handle Russian text correctly', () => {
      const html = `
        <html>
          <body>
            <div class="post_body" id="p-123">
              <div class="sp-wrap">
                <div class="sp-head folded"><span>1997. Ноль - Песня о безответной любви</span></div>
                <div class="sp-body">
                  <span class="post-b">Треклист</span>:<br>
                  1. Песня о безответной любви к Родине<br>
                  2. Иду, курю<br>
                  3. Человек и кошка<br>
                </div>
              </div>
            </div>
          </body>
        </html>
      `

      const result = parseAlbumsFromHtml(html)
      expect(result.albums).toHaveLength(1)
      expect(result.albums[0].title).toBe('Песня о безответной любви')
      expect(result.albums[0].tracks[0].title).toBe('Песня о безответной любви к Родине')
      expect(result.albums[0].tracks[2].title).toBe('Человек и кошка')
    })
  })
})
