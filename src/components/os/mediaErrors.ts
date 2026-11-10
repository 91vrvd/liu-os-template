const messages: Record<string, { zh: string; en: string }> = {
  'audio-file-invalid': { zh: '请选择 MP3、M4A、AAC、WAV、OGG、FLAC 或 WebM 音频，单个文件不超过 50 MB。', en: 'Choose MP3, M4A, AAC, WAV, OGG, FLAC or WebM files up to 50 MB each.' },
  'local-audio-missing': { zh: '本地音频已被浏览器清理，请重新导入。', en: 'This local file was cleared by the browser. Please import it again.' },
  'audio-storage-failed': { zh: '浏览器存储空间不足，没能保存这首本地音频。', en: 'Browser storage is full, so the local file could not be saved.' },
  'track-unavailable': { zh: '这首歌暂时无法播放，可能需要会员、有版权地区限制或源已失效，已自动尝试下一首。', en: 'This song is unavailable (membership, region or source limits). Trying the next one.' },
  'track-unavailable-single': { zh: '这首歌暂时无法播放，可能需要会员、有版权地区限制或源已失效。换一首或换个平台试试。', en: 'This song is unavailable (membership, region or source limits). Try another song or platform.' },
  'spotify-player-unavailable': { zh: 'Spotify 播放器暂时无法加载，请检查网络后重试，或打开原链接。', en: 'Spotify player could not load. Check the network or open the original link.' },
  'media-controller-unavailable': { zh: '播放器还没准备好，请稍后再点一次播放。', en: 'The player is not ready yet. Try again in a moment.' },
  'audio-source-missing': { zh: '这首歌没有可用的音频地址。', en: 'This track has no playable audio address.' },
};

export const mediaErrorText = (code: string, language: 'zh' | 'en') => (
  messages[code]?.[language]
  ?? (language === 'zh' ? '音频无法播放，可能是格式、跨域、防盗链或网络限制。' : 'Audio could not play. The format, cross-origin rules, hotlink protection or the network may be blocking it.')
);
