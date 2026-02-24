import { isNonAudioResult } from '../nonAudioDetector'
import type { SearchResult } from '../../types/search.types'

/** Helper: create a minimal SearchResult with a given title */
function result(title: string): SearchResult {
  return {
    id: '1',
    title,
    author: '',
    size: '0',
    seeders: 0,
    leechers: 0,
    url: '',
  }
}

describe('isNonAudioResult', () => {
  describe('should detect non-audio content', () => {
    const nonAudioTitles = [
      // Movies / TV — video rip formats
      'Нирвана / Nirvana [1997, BDRip 1080p] DVO + AVO',
      'Some Movie Title [HDRip 720p]',
      'Documentary [WEBRip] English subtitles',
      'Film Name WEB-DL 1080p',
      'Movie BDRemux 2160p',
      'Фильм [TVRip]',
      'Movie [SATRip]',
      'Old Movie [CAMRip]',
      'Movie [DVDRip]',
      'Фильм [Remux]',
      // Movie voice-over dubbing
      'Нирвана / Nirvana [1997] DVO + AVO (Гаврилов)',
      'Фильм MVO (Кубик в кубе)',
      // PDFs / books
      'Nirvana - Song Book [PDF]',
      'Книга о рок-музыке',
      'Учебник по гитаре',
      'Самоучитель игры на барабанах',
      // Audiobooks
      'Kurt Cobain Biography [Audiobook]',
      'Аудиокнига - История рок-музыки',
      // Video lessons
      'Video Lesson - Guitar techniques',
      'Видео урок по гитаре',
      // DVD without audio formats
      'Concert DVD PAL',
      // Blu-ray without audio formats
      'Live Concert Blu-ray',
      // Guitar tabs / sheet music
      'Nirvana - Guitar Pro tabs',
      'Metallica GTP collection',
      'Табулатуры для гитары',
      'Ноты для фортепиано',
      // Software / plugins
      'Amplitube VSTi Plugin',
      'Guitar Rig VST3',
      'Music Software Collection',
      'Программа для сведения',
      // Karaoke
      'Karaoke Collection 2024',
      'Караоке хиты 90-х',
      'Минусовка популярных песен',
      // E-books (from example.html)
      'Dave Grohl / Дэйв Грол - The Storyteller [2022, FB2, RUS]',
      'Guitar Method Book [EPUB]',
      'Music Theory Guide [DJVU]',
      'Rock History [MOBI]',
      // Video games (from example2.html)
      'AI: The Somnium Files (Build 9637785 + 5 DLC) [Portable]',
      // DVD video disc formats (from example4.html)
      'Nirvana - With The Lights Out (NTSC) [2004, DVD5]',
      'Kurt Cobain - Montage Of Heck [2015, Documentary, DVD9]',
      'Concert Film [PAL]',
      // Documentary (from example5.html)
      'Kurt Cobain Documentary [2015, DVD9 Custom]',
      'Документальный фильм о Nirvana',
      // Low-bitrate audiobook (from example3.html)
      'Голдберг Дэнни - Курт Кобейн [2019, 56 kbps, MP3]',
      'Audiobook Title [2019, 32 kbps, MP3]',
      'Мемуары рок-звезды [64 kbps, MP3]',
    ]

    test.each(nonAudioTitles)('"%s"', (title) => {
      expect(isNonAudioResult(result(title))).toBe(true)
    })
  })

  describe('should NOT detect legitimate music content', () => {
    const musicTitles = [
      // Regular albums
      'Nirvana - Nevermind (1991) [FLAC]',
      'Nirvana - In Utero [MP3 320kbps]',
      'Nirvana - Unplugged in New York [FLAC, Lossless]',
      'Pink Floyd - The Wall (1979) [24bit/96kHz FLAC]',
      'Metallica - Master of Puppets [APE, CUE]',
      // Discographies
      'Nirvana - Discography (1989-1994) [FLAC]',
      'Led Zeppelin - Complete Studio Albums [MP3]',
      // Music with bonus video ("+Video" pattern)
      'Nirvana - Nevermind [+Video, FLAC]',
      'Album Name [+Video, WEB-DL, 480p] FLAC',
      // DVD with audio formats (should NOT be hidden)
      'Concert DVD FLAC',
      'Live DVD MP3',
      'Blu-ray Audio FLAC Lossless',
      // Live recordings
      'Nirvana - Live at Reading (1992) [FLAC]',
      'Concert Recording 2024 [WAV]',
      // Compilations
      'Greatest Hits Collection [MP3 VBR]',
      // Singles / EPs
      'Smells Like Teen Spirit [Single, FLAC]',
      // Music with normal bitrates (should NOT be caught by low-bitrate rule)
      'Nirvana - In Utero [MP3, 320 kbps]',
      'Album Name [MP3, 192 kbps]',
      'Album Name [128 kbps, MP3]',
      // DVD/Blu-ray with audio formats (should NOT be hidden)
      'Concert DVD5 FLAC',
      'Live Performance NTSC FLAC',
    ]

    test.each(musicTitles)('"%s"', (title) => {
      expect(isNonAudioResult(result(title))).toBe(false)
    })
  })
})
