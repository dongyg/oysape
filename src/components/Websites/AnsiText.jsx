import React from 'react';
import { AnsiUp } from 'ansi_up';

const ansi_up = new AnsiUp();

const cleanAnsiString = (text) => {
  return text.replace(/\x1b\[\?2004[lh]/g, '')
             .replace(/\x1b\]0;.*?\x07/g, '')
             .replace(/\x1b\[[0-9;]*m/g, '');
};

const AnsiText = ({ text }) => {
  const cleanedText = cleanAnsiString(text).trim();
  let html = ansi_up.ansi_to_html(cleanedText);
  html = html.replace(/\n/g, '<br />');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export default AnsiText;
