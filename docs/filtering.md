# Filtering Model

X Reply Janitor uses a transparent score instead of an opaque model.

Each visible reply gets a score from several weak signals:

- Built-in spam phrase rules.
- Mentions used as a lure.
- Very short replies ending in an account mention.
- Random-looking handles with digits and underscores.
- Duplicate normalized text on the same page.
- Very fresh replies that also contain a mention.

The default threshold is `4.5`. The popup strictness changes the effective threshold:

- Relaxed: threshold + 0.6
- Balanced: threshold
- Aggressive: threshold - 0.6 and a small mention penalty

Default behavior is `collapse`, which inserts a small restore control before the hidden reply. Use `hide` if you want no placeholder, or `dim` if you prefer to keep likely spam visible but muted.

## False positives

The safest way to fix a false positive is to add that handle to the whitelist from the options page.

If a built-in pattern is too broad, tighten the regex and add an example in the PR description.
