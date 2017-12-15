// ==UserScript==
// @name     Workspace Demo Assistant
// @version  1
// @description  Removes the vertical bar used to identify apps.
// @author       van_staub@us.ibm.com
// @match        https://workspace.ibm.com/*
// @grant    none
// ==/UserScript==

(function () {
  'use strict'

  function run () {
    setTimeout(function () {
      // the rgb values are set by the demo app
      var elements = document.querySelectorAll('div[style="background-color: rgb(255, 255, 255);"]')
      console.log(elements.length)
      if (elements.length > 0) {
        elements.forEach(element => {
          element.parentNode.removeChild(element)
        })
      }

      run()
    }, 500)
  }

  run()
})()
