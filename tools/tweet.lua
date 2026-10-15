-- {{< tweet https://x.com/user/status/123 >}}: an embedded post from X (Twitter).
-- At build time the post's text is fetched from X's oEmbed service and written into the page,
-- so the page still shows the text (as a quote) if X's script is blocked or the post is deleted
-- later. X's widgets.js then turns it into the usual card. If the fetch fails, the page gets a
-- plain link to the post instead.

local function escape(s)
  return (s:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub('"', "&quot;"))
end

local function fetch_html(url)
  local ok, mime, body = pcall(pandoc.mediabag.fetch,
    "https://publish.x.com/oembed?omit_script=1&dnt=true&url=" .. url)
  if not ok or not body then return nil end
  local ok2, data = pcall(quarto.json.decode, body)
  if ok2 and type(data) == "table" and type(data.html) == "string" and data.html:find("twitter%-tweet") then
    return data.html
  end
  return nil
end

local script_added = false

return {
  ["tweet"] = function(args, kwargs, meta, raw_args, context)
    local arg = pandoc.utils.stringify(args[1] or "")
    local host, user, id = arg:match("^https?://([^/]+)/([%w_]+)/statuse?s?/(%d+)")
    host = (host or ""):gsub("^www%.", ""):gsub("^mobile%.", "")
    if not id or (host ~= "x.com" and host ~= "twitter.com") then
      quarto.log.warning("tweet shortcode: not a link to a post on X: " .. arg)
      return pandoc.Null()
    end
    local url = "https://x.com/" .. user .. "/status/" .. id
    local html = fetch_html(url)
    if not html then
      quarto.log.warning("tweet shortcode: couldn't fetch " .. url .. " (showing a plain link)")
      html = '<blockquote class="twitter-tweet" data-dnt="true"><p>Post by @' .. escape(user) ..
        ' on X</p><a href="' .. escape(url) .. '">' .. escape(url) .. '</a></blockquote>'
    end
    if not script_added then
      script_added = true
      quarto.doc.include_text("after-body", [[
<script>
// Match the site's light/dark mode when X draws the posts
if (document.body.classList.contains("quarto-dark"))
  document.querySelectorAll("blockquote.twitter-tweet").forEach(q => q.setAttribute("data-theme", "dark"));
// ...and redraw them if the reader flips the light/dark switch
new MutationObserver(() => {
  const theme = document.body.classList.contains("quarto-dark") ? "dark" : "light";
  if (!window.twttr || !twttr.widgets || document.body.dataset.tweetTheme === theme) return;
  document.body.dataset.tweetTheme = theme;
  document.querySelectorAll(".tweet-embed").forEach(box => {
    if (!box.querySelector("iframe")) return;   // X couldn't draw this one; leave the quote
    // X only draws into an element on the page: draw the new card off-screen, then swap
    const old = [...box.children], div = document.createElement("div");
    div.style.cssText = "position: absolute; left: -9999px; width: 550px"; box.append(div);
    twttr.widgets.createTweet(box.dataset.tweetId, div, { dnt: true, theme, align: "center" })
      .then(el => { if (el) { old.forEach(c => c.remove()); div.style.cssText = ""; } else div.remove(); });
  });
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });
</script>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>]])
    end
    html = '<div class="tweet-embed" data-tweet-id="' .. id .. '">' .. html .. '</div>'
    if context == "inline" then return pandoc.RawInline("html", html) end
    return pandoc.RawBlock("html", html)
  end
}
