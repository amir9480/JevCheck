// Writes public/schema/question-set.v<N>.json from the zod schema (src/lib/question-set-schema.ts).
// Run with `pnpm schema` after changing the schema; `--check` fails if the file is out of date.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {CONFIG_VERSION, questionSetJsonSchema} from '../src/lib/question-set-schema'

const file = resolve(import.meta.dirname, `../public/schema/question-set.v${CONFIG_VERSION}.json`)
const json = JSON.stringify(questionSetJsonSchema(), null, 2) + '\n'

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(file, 'utf8')
  } catch {}
  if (current !== json) {
    console.error(`${file} is out of date. Run \`pnpm schema\`.`)
    process.exit(1)
  }
} else {
  mkdirSync(dirname(file), {recursive: true})
  writeFileSync(file, json)
  console.log(`Wrote ${file}`)
}
