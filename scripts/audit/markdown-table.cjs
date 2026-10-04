'use strict';

function escapeMarkdownTableText(value) {
  return String(value).replace(/[\\|]/g, character => '\\' + character);
}

module.exports = { escapeMarkdownTableText };
