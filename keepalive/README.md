# Keep Supabase awake (Linux cron)

The free Supabase plan pauses a project after about 7 days without activity.
`keepalive.sh` calls `keepalive_ping()` twice a day. That function inserts one row and deletes it
in the same call, so the database sees a real write and nothing is left behind.

## Setup (about 5 minutes)

1. Run `supabase/migrations/20260927000007_keepalive.sql` in Supabase > SQL Editor.
2. Copy the script and make it executable:
   ```bash
   mkdir -p ~/arshs-keepalive
   cp keepalive.sh ~/arshs-keepalive/
   chmod +x ~/arshs-keepalive/keepalive.sh
   ```
3. Create the config file (use your Project URL and anon/publishable key, the same ones as in `.env.local`):
   ```bash
   mkdir -p ~/.config
   nano ~/.config/arshs-keepalive.env
   ```
   ```
   SUPABASE_URL=https://abcdxyz.supabase.co
   SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```
   ```bash
   chmod 600 ~/.config/arshs-keepalive.env
   ```
4. Test it once by hand:
   ```bash
   ~/arshs-keepalive/keepalive.sh && echo WORKED
   tail -n 3 ~/.local/state/arshs-keepalive.log
   ```
   You should see `WORKED` and a line starting with `OK {"ok": true, ...}`.
5. Add the cron job:
   ```bash
   crontab -e
   ```
   Pick `nano` if asked, then add this line at the bottom (runs at 09:00 and 21:00 every day):
   ```
   0 9,21 * * * $HOME/arshs-keepalive/keepalive.sh
   ```
   Save with `Ctrl+O`, `Enter`, exit with `Ctrl+X`.
6. Check it's scheduled and cron is running:
   ```bash
   crontab -l
   systemctl status cron
   ```

## Checking later

```bash
tail -n 10 ~/.local/state/arshs-keepalive.log
```

Each run adds one `OK` line. The log keeps the last 500 lines, so it never grows.

## If you see FAIL

| In the log | Fix |
|---|---|
| `HTTP 401` or `Invalid API key` | Wrong key in the config file |
| `HTTP 404` and `keepalive_ping` | Step 1 (the SQL file) wasn't run |
| `HTTP 000` / `Could not resolve host` | Internet was down; the script already retried 3 times. Next run will likely succeed |
| `HTTP 540` or a "paused" message | The project already paused. Resume it once in the Supabase dashboard; cron keeps it awake from then on |
| `config not found` | Step 3: the file must be at `~/.config/arshs-keepalive.env` |

To stop it: `crontab -e` and delete the line.
