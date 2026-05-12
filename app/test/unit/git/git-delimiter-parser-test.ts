import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createForEachRefParser } from '../../../src/lib/git/git-delimiter-parser'

describe('git/git-delimiter-parser', () => {
  describe('createForEachRefParser', () => {
    it('parses for-each-ref output with CRLF record separators', () => {
      const { parse } = createForEachRefParser({
        fullName: '%(refname)',
        shortName: '%(refname:short)',
        sha: '%(objectname)',
      })

      const output = [
        '',
        'refs/heads/main',
        'main',
        '0123456789abcdef',
        '\r\n',
        'refs/remotes/origin/main',
        'origin/main',
        'fedcba9876543210',
        '\r\n',
        '',
      ].join('\0')

      assert.deepEqual(parse(output), [
        {
          fullName: 'refs/heads/main',
          shortName: 'main',
          sha: '0123456789abcdef',
        },
        {
          fullName: 'refs/remotes/origin/main',
          shortName: 'origin/main',
          sha: 'fedcba9876543210',
        },
      ])
    })

    it('still rejects malformed record separators', () => {
      const { parse } = createForEachRefParser({
        fullName: '%(refname)',
      })

      assert.throws(
        () => parse(['', 'refs/heads/main', 'not-a-newline', ''].join('\0')),
        /Expected newline/
      )
    })
  })
})
