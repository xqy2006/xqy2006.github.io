import { defineCommand } from '../../core/registry.js'

export default defineCommand({
  name: 'sudo',
  description: 'you are not in the sudoers file',
  usage: 'sudo <command>',
  run(ctx, line) {
    if (!line.args.length) { ctx.error('usage: sudo <command>'); return }
    ctx.error(`${ctx.site.user} is not in the sudoers file. This incident has been reported.`)
  },
})
