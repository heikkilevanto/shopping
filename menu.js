// menu.js - menu handling for my shopping list app

"use strict";  // Croak on undefined vars etc



// --------- Simple helpers
function makeMenuButton() {
  const menuButton = document.createElement('button');
  menuButton.textContent = '☰';
  menuButton.type = 'button';
  menuButton.style.padding = '0.15em 0.5em';
  return menuButton;
};


function makeMainMenuDiv() {
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.style.display = 'none';
  menu.style.position = 'absolute';
  menu.style.background = '#fff';
  menu.style.border = '1px solid #ccc';
  menu.style.padding = '4px 0';
  menu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
  menu.style.zIndex = '1000';
  return menu;
};
