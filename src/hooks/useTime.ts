import { useState, useEffect } from 'react';
import { Language } from '../i18n';

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMenuBarDateTime(date: Date, language: Language) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  if (language === 'en') {
    const hours24 = date.getHours();
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;

    return `${WEEKDAYS_EN[date.getDay()]} ${MONTHS_EN[date.getMonth()]} ${day} ${hours12}:${minutes}:${seconds} ${period}`;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  return `${month}月${day}日 ${hours}:${minutes}:${seconds}`;
}

function formatShortTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

export const useTime = (language: Language = 'zh') => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return {
    time,
    formattedTime: formatMenuBarDateTime(time, language),
    shortTime: formatShortTime(time)
  };
};
