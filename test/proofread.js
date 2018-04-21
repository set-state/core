const vfile = require('to-vfile')
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
const glob = require('fast-glob')

glob(['!CHANGELOG.md', '*.md']).then(files =>
  files.map(file => process(vfile.readSync(file)))
)

function process (ast) {
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
            'npm',
            'Codestyle'
          ].join('\n')
        })
    )
    .use(stringify)
    .process(ast, function (err, file) {
      if (file.messages[0].actual.startsWith('npm version')) {
        file.messages.splice(0, 1)
      }
      console.error(report(err || file))
    })
}
