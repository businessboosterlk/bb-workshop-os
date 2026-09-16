import { Injectable, signal } from '@angular/core';

/* Two languages for the customer app, switched per phone. English is the source; the
   Sinhala lines are a first draft for the workshop to check before the app goes live. */
export type Lang = 'en' | 'si';
const SI: Record<string, string> = {
  'Your cars': 'ඔබේ වාහන', 'Your car': 'ඔබේ වාහනය', 'History': 'ඉතිහාසය', 'Settings': 'සැකසුම්',
  'Sign in': 'ඇතුල් වන්න', 'Phone number': 'දුරකථන අංකය', 'Code': 'කේතය', 'Send code': 'කේතය යවන්න', 'Enter': 'ඇතුල් වන්න',
  'We sent a code to your phone': 'කේතය ඔබේ දුරකථනයට යැව්වා', 'Right now': 'දැන්', 'Done': 'අවසන්', 'Next': 'ඊළඟ',
  'Promised': 'පොරොන්දු වූ දිනය', 'Ready for pickup': 'ගෙන යාමට සූදානම්', 'Delivered': 'භාර දුන්නා',
  'Approve': 'අනුමත කරන්න', 'Decline': 'ප්‍රතික්ෂේප කරන්න', 'Needs your approval': 'ඔබේ අනුමැතිය අවශ්‍යයි',
  'Message the workshop': 'වැඩපොළට පණිවිඩයක්', 'Pickup and drop': 'ගෙන යාම සහ ගෙනවිත් දීම', 'Photos': 'ඡායාරූප',
  'No cars yet': 'තවම වාහන නැත', 'Sign out': 'ඉවත් වන්න', 'Language': 'භාෂාව', 'Night mode': 'රාත්‍රී මාදිලිය', 'Day mode': 'දිවා මාදිලිය',
  'of': 'න්', 'to': 'සිට', 'phases': 'අදියර', 'Rate the work': 'වැඩය ඇගයන්න', 'Insurance claim': 'රක්ෂණ හිමිකම',
  'Date moved': 'දිනය වෙනස් විය', 'because': 'හේතුව', 'Your previous jobs': 'පෙර වැඩ', 'Booked': 'වෙන් කළා', 'Collected': 'ගෙන ගියා', 'Returned': 'ගෙනවිත් දුන්නා',
  'Handover': 'භාර දීම', 'Thank you': 'ස්තූතියි', 'Leave a Google review': 'Google සමාලෝචනයක් තබන්න',
  'Put it on your home screen': 'මුල් තිරයට එක් කරන්න', 'Install': 'ස්ථාපනය කරන්න', 'Opens like an app, no browser bar.': 'යෙදුමක් ලෙස විවෘත වේ.',
  'Tap Share, then Add to Home Screen.': 'Share ඔබා, ඉන්පසු Add to Home Screen තෝරන්න.', 'Open the browser menu and choose Add to Home screen.': 'බ්‍රවුසර මෙනුවෙන් Add to Home screen තෝරන්න.',
  'Your phone is your login. No password to remember.': 'ඔබේ දුරකථන අංකයම ඔබේ ලොගින් එකයි. මුරපදයක් නැත.'
};
@Injectable({ providedIn: 'root' })
export class LangService {
  readonly lang = signal<Lang>('en');
  constructor(){ try { const l = localStorage.getItem('wos_lang'); if (l === 'si' || l === 'en') this.lang.set(l); } catch {} this.paint(); }
  t(s: string): string { return this.lang() === 'si' ? (SI[s] || s) : s; }
  set(l: Lang){ this.lang.set(l); try { localStorage.setItem('wos_lang', l); } catch {} this.paint(); }
  private paint(){ document.documentElement.lang = this.lang(); document.documentElement.classList.toggle('si', this.lang() === 'si'); }
}
