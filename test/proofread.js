const fs = require('fs')
const path = require('path')
const unified = require('unified')
const markdown = require('remark-parse')
const lint = require('remark-lint')
const remark2retext = require('remark-retext')
const english = require('retext-english')
const equality = require('retext-equality')
const passive = require('retext-passive')
const simplify = require('retext-simplify')
const readability = require('retext-readability')
const goolge = require('retext-google-styleguide')
const spell = require('retext-spell')
const dictionary = require('dictionary-en-us')
const stringify = require('remark-stringify')
const report = require('vfile-reporter')

unified()
  .use(markdown)
  .use(lint)
  .use(
    remark2retext,
    unified()
      .use(english)
      .use(equality)
      .use(passive)
      .use(simplify)
      .use(readability)
      .use(goolge)
      .use(spell, {
        dictionary,
        personal: [
          'Grenier',
          'AutoSponge',
          'Redux',
          'PureState',
          'middleware',
          'Codestyle'
        ].join('\n')
      })
  )
  .use(stringify)
  .process(fs.readFileSync('./README.md'), function (err, file) {
    console.error(report(err || file))
  })
