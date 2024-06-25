import React from 'react';
import { AnsiUp } from 'ansi_up';

const ansi_up = new AnsiUp();

const cleanAnsiString = (text) => {
  const patterns = [
    '\\u001b\\[\\?2004[lh]',  // Matches \x1b[?2004[lh]
    '\\u001b\\]0;.*?\\u0007', // Matches \x1b]0;.*?\x07
    '\\u001b\\[[0-9;]*m'      // Matches \x1b[[0-9;]*m
  ];

  patterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'g');
    text = (text || '').replace(regex, '');
  });

  return text;
};

const AnsiText = ({ text }) => {
  const cleanedText = cleanAnsiString(text).trim();
  let html = ansi_up.ansi_to_html(cleanedText);
  html = html.replace(/\n/g, '<br />');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export default AnsiText;
