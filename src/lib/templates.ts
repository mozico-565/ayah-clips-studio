import mountains from '@/assets/mountains.mp4.asset.json';
import nature from '@/assets/nature.mp4.asset.json';
import kaaba from '@/assets/kaaba.mp4.asset.json';
import mosque from '@/assets/mosque.mp4.asset.json';
import mountainPoster from '@/assets/mountains.jpg.asset.json';
import naturePoster from '@/assets/nature.jpg.asset.json';
import kaabaPoster from '@/assets/kaaba.jpg.asset.json';
import mosquePoster from '@/assets/mosque.jpg.asset.json';
export const TEMPLATES = [
  { id: 'mountains', label: 'جبال سينمائية', src: mountains.url, poster: mountainPoster.url, credit: 'Mixkit · Stock Video Free License', source: 'https://mixkit.co/free-stock-video/snowy-mountains-landscape-2602/', license: 'https://mixkit.co/license/#videoFree' },
  { id: 'nature', label: 'الطبيعة', src: nature.url, poster: naturePoster.url, credit: 'Mixkit · Stock Video Free License', source: 'https://mixkit.co/free-stock-video/snowy-trees-on-a-mountain-2604/', license: 'https://mixkit.co/license/#videoFree' },
  { id: 'kaaba', label: 'الكعبة', src: kaaba.url, poster: kaabaPoster.url, credit: 'World of Travel · CC BY 3.0 · مقتطف صامت', source: 'https://commons.wikimedia.org/wiki/File:Makkah_Al-Mukarramah_-Kaaba-_Ramadan_2016.webm', license: 'https://creativecommons.org/licenses/by/3.0/' },
  { id: 'mosque', label: 'المسجد الحرام', src: mosque.url, poster: mosquePoster.url, credit: 'World of Travel · CC BY 3.0 · مقتطف آخر من الحرم', source: 'https://commons.wikimedia.org/wiki/File:Makkah_Al-Mukarramah_-Kaaba-_Ramadan_2016.webm', license: 'https://creativecommons.org/licenses/by/3.0/' },
];