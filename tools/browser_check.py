#!/usr/bin/env python3
"""Keyboard, focus, reduced-motion, overflow and alt-text checks in headless Chrome.
Serve the built site first:  python3 -m http.server 8080 -d _site
then run:  python3 tools/browser_check.py [http://127.0.0.1:8080]
Needs google-chrome and `pip install --user websocket-client`."""
import json, subprocess, time, urllib.request, websocket, sys
PORT=9333; BASE=sys.argv[1] if len(sys.argv)>1 and sys.argv[1].startswith("http") else "http://127.0.0.1:8080"
chrome=subprocess.Popen(["google-chrome","--headless=new","--no-sandbox","--disable-gpu",f"--remote-debugging-port={PORT}",
  "--user-data-dir=/tmp/site-check-chrome","about:blank"],
  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try:
        tabs=json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json")); break
    except Exception: time.sleep(.2)
ws_url=[t for t in tabs if t["type"]=="page"][0]["webSocketDebuggerUrl"]
results=[]
def ok(name, cond, info=""):
    results.append(("PASS" if cond else "FAIL", name, info))

def main():
    ws=websocket.create_connection(ws_url, max_size=50_000_000, suppress_origin=True)
    if True:
        mid=0
        def send(method, **params):
            nonlocal mid; mid+=1; my=mid
            ws.send(json.dumps({"id":my,"method":method,"params":params}))
            while True:
                m=json.loads(ws.recv())
                if m.get("id")==my: return m.get("result",{})
        def ev(expr):
            r=send("Runtime.evaluate", expression=expr, returnByValue=True)
            return r.get("result",{}).get("value")
        def go(url, w=1280, h=900):
            send("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=1, mobile=w<500)
            send("Page.navigate", url=BASE+url); time.sleep(1.2)
        def key(k, code=None, vk=0, shift=False):
            mods=8 if shift else 0
            extra={"text":"\r","unmodifiedText":"\r"} if k=="Enter" else {}
            send("Input.dispatchKeyEvent", type="keyDown", key=k, code=code or k, windowsVirtualKeyCode=vk, modifiers=mods, **extra)
            send("Input.dispatchKeyEvent", type="keyUp", key=k, code=code or k, windowsVirtualKeyCode=vk, modifiers=mods)
            time.sleep(.08)
        TAB=lambda shift=False: key("Tab","Tab",9,shift)
        ENTER=lambda: key("Enter","Enter",13)
        ESC=lambda: key("Escape","Escape",27)
        active="(function(){var a=document.activeElement;return a.tagName+'.'+(a.className||'')+' '+(a.getAttribute('aria-label')||a.textContent||'').trim().slice(0,40)})()"
        send("Page.enable"); send("Runtime.enable")

        # 0. reduced motion: reel starts paused, nothing gets the reveal class
        send("Emulation.setEmulatedMedia", features=[{"name":"prefers-reduced-motion","value":"reduce"}])
        go("/")
        r=ev("[document.getElementById('reel').classList.contains('is-paused'), document.querySelector('#reel video').paused, document.querySelectorAll('.rv').length, getComputedStyle(document.querySelector('.intro__name')).animationName]")
        ok("reduced motion: reel paused, no reveals, no load animation", r[0] and r[1] and r[2]==0 and r[3]=='none', str(r))
        send("Emulation.setEmulatedMedia", features=[{"name":"prefers-reduced-motion","value":"no-preference"}])

        # 1. skip link is the first tab stop and jumps to main
        go("/")
        TAB(); a=ev(active); ok("first Tab lands on skip link", "skip-link" in a, a)
        ENTER(); h=ev("location.hash"); ok("skip link targets #main", h=="#main", h)

        # 2. focus visible: outline present on focused element
        go("/"); TAB(); TAB()
        o=ev("getComputedStyle(document.activeElement).outlineStyle"); ok("focused link shows an outline", o!="none", o)

        # 3. reel pause button by keyboard
        go("/")
        ev("document.getElementById('reel-toggle').focus()")
        ENTER(); p=ev("[document.getElementById('reel').classList.contains('is-paused'), document.getElementById('reel-toggle').getAttribute('aria-pressed'), document.querySelector('#reel video').paused]")
        ok("Enter on reel toggle pauses video", p==[True,"true",True], str(p))

        # 4. theme toggle by keyboard updates label
        ev("document.getElementById('theme-toggle').focus()"); before=ev("document.documentElement.dataset.theme")
        ENTER(); after=ev("[document.documentElement.dataset.theme, document.getElementById('theme-toggle').getAttribute('aria-label')]")
        ok("theme toggle switches theme and label", after[0]!=before and ('light' in after[1] if after[0]=='dark' else 'dark' in after[1]), f"{before} -> {after}")
        ENTER()

        # 5. filters by keyboard
        go("/projects/")
        ev("document.querySelector('.chip[data-filter=slam]').focus()"); ENTER()
        r=ev("[document.querySelectorAll('[data-domains]:not(.is-filtered)').length, document.querySelectorAll('[data-domains]').length, document.querySelector('.chip[data-filter=slam]').getAttribute('aria-pressed')]")
        ok("SLAM filter hides non-matching cards", r[0]>0 and r[0]<r[1] and r[2]=="true", str(r))

        # 6. lightbox: open by keyboard, focus inside, trapped, Escape returns focus
        go("/projects/robocon-2023/")
        ev("document.querySelector('a.zoom').focus()"); opener=ev(active)
        ENTER()
        st=ev("[document.querySelector('.lb').classList.contains('is-open'), document.activeElement.className]")
        ok("Enter on image opens lightbox with focus on close", st[0] and 'lb__close' in st[1], str(st))
        seen=set()
        for _ in range(5):
            TAB(); seen.add(ev("document.querySelector('.lb').contains(document.activeElement)"))
        ok("Tab stays inside the open lightbox", seen=={True}, str(seen))
        key("ArrowRight","ArrowRight",39); cap=ev("document.querySelector('.lb figcaption').textContent")
        ok("ArrowRight moves to next image", bool(cap), cap)
        ESC(); back=ev(active)
        ok("Escape closes and returns focus to the image link", (ev("!document.querySelector('.lb').classList.contains('is-open')")) and back==opener, back)

        # 7. YouTube facade by keyboard
        go("/research/remote-labs/")
        ev("document.querySelector('.yt__play').focus()"); ENTER(); time.sleep(.5)
        y=ev("!!document.querySelector('.yt iframe') && document.activeElement.tagName")
        ok("Enter on YouTube thumbnail loads the player and focuses it", y=="IFRAME", str(y))

        # 8. mobile menu: opens, Escape closes and refocuses the burger
        go("/", 390, 800)
        ev("document.getElementById('nav-burger').focus()"); ENTER()
        m1=ev("[document.getElementById('nav-mobile').classList.contains('is-open'), document.getElementById('nav-burger').getAttribute('aria-expanded')]")
        ESC(); m2=ev("[document.getElementById('nav-mobile').classList.contains('is-open'), document.activeElement.id]")
        ok("mobile menu opens and Escape closes it", m1==[True,"true"] and m2==[False,"nav-burger"], f"{m1} {m2}")

        # 9. no horizontal scroll at phone width on every page
        pages=["/","/research/","/projects/","/about/","/404.html"]+[f"/research/{s}/" for s in ["coop-manipulation","soft-mobile-manipulators","niti-vahan","remote-labs","visual-slam-uav","arms-ackermann"]]+[f"/projects/{s}/" for s in ["nitk-shuttle","robocon-2023","so101-imitation","lehome-icra-2026","ur5-pick-place"]]
        over=[]
        for pth in pages:
            go(pth, 360, 780)
            w=ev("[document.documentElement.scrollWidth, window.innerWidth]")
            if w[0]>w[1]: over.append((pth,w))
        ok(f"no horizontal overflow at 360px on {len(pages)} pages", not over, str(over))

        # 10. images: every <img> has an alt attribute; buttons have names
        missing=[]; noname=[]
        for pth in ["/","/research/","/projects/","/about/","/research/visual-slam-uav/","/projects/robocon-2023/"]:
            go(pth)
            missing+= [pth+" "+x for x in (ev("[...document.images].filter(i=>!i.hasAttribute('alt')).map(i=>i.src.slice(-40))") or [])]
            noname += [pth+" "+x for x in (ev("[...document.querySelectorAll('button,a')].filter(e=>!(e.getAttribute('aria-label')||e.textContent.trim())).map(e=>e.outerHTML.slice(0,60))") or [])]
        ok("every image has an alt attribute", not missing, str(missing[:4]))
        ok("every link and button has an accessible name", not noname, str(noname[:4]))

try:
    main()
finally:
    chrome.terminate()
for r in results: print(f"{r[0]}  {r[1]}" + (f"   [{r[2]}]" if r[0]=="FAIL" or "--v" in sys.argv else ""))
print(f"\n{sum(r[0]=='PASS' for r in results)}/{len(results)} passed")
