#!/usr/bin/env python3
"""
Builds the cue data for the Three Musketeers DCA cue app and marks the script PDF.

Inputs : tools/ocr.json            (text + positions of every line in the scanned script)
         ../1978_001.pdf           (the scanned script)
Outputs: data/show.json            (scenes, DCA layout, cues, script positions)
         1978_001_MIC_CUES.pdf     (script with every mic cue marked, pages turned upright)

Edit MICS / SCENES below and re-run:  python3 tools/build.py
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PDF = os.path.join(ROOT, "1978_001.pdf")
OUT_PDF = os.path.join(ROOT, "1978_001_MIC_CUES.pdf")
OCR = os.path.join(ROOT, "tools", "ocr.json")
OUT_JSON = os.path.join(ROOT, "data", "show.json")

# ---------------------------------------------------------------- mic list (page 1 of the PDF)
# mic/channel number -> (channel name on the console, DCA name: 8 characters max on the Wing)
MICS = {
    1:  ("D'Artagnan", "D'Arty"),
    2:  ("Sabine", "Sabine"),
    3:  ("Cardinal", "Cardinal"),
    4:  ("Rochefort", "Rochfort"),
    5:  ("Basille/Duke", "Basille"),
    6:  ("Athos", "Athos"),
    7:  ("Porthos", "Porthos"),
    8:  ("Aramis", "Aramis"),
    9:  ("Milady", "Milady"),
    10: ("Treville", "Treville"),
    11: ("Elise/Sister", "Elise"),
    12: ("Adele", "Adele"),
    13: ("Constance", "Constnce"),
    14: ("King", "King"),
    15: ("Queen Anne", "Queen"),
    16: ("Beggar/DeBris", "Beggar"),
    17: ("Mother Superior", "MotherSu"),
    18: ("Innkeeper", "Innkeepr"),
    20: ("Servant", "Servant"),
    21: ("Father", "Father"),
}

# Doubled roles: which character the mic is playing in a given scene -> (channel name, DCA name)
ROLE = {
    "Basille": ("Basille", "Basille"),
    "Duke": ("Duke Buckingham", "Duke"),
    "Milady": ("Milady", "Milady"),
    "Sophie": ("Milady (Sophie)", "Sophie"),
    "Elise": ("Elise", "Elise"),
    "Sister": ("Sister", "Sister"),
    "Beggar": ("Beggar (DeBris)", "Beggar"),
    "DeBris": ("DeBris", "DeBris"),
}

# ---------------------------------------------------------------- the cue list
# Each scene: id, title, roles (overrides for doubled mics), cues.
# Each cue: (label, [mics live], pdf page, side L/R/F, text that starts the cue on that page)
# The DCA order of a scene is the order in which mics first appear in its cues.
SCENES = [
 dict(id="0", title="Curtain speech (pre-show)", cues=[
  ("Curtain speech - Milady", [9], 2, "R", "Pre-Show Music on"),
]),
dict(id="1.1", title="Farmhouse in Gascony", cues=[
   ("D'Artagnan & Father duel", [1, 21], 2, "R", "Scene 1"),
   ("Sabine enters", [1, 21, 2], 4, "L", "you. Sabine!"),
   ("Father exits", [1, 2], 5, "L", "SABINE. Turn around."),
 ]),
 dict(id="1.2", title="Outside the Cardinal's Palace", cues=[
   ("Cardinal (off) + Musketeers", [3, 7, 8, 6], 5, "R", "Scene 2"),
   ("Cardinal muted - Musketeers", [7, 8, 6], 6, "L", "PORTHOS. Let's get out of here"),
   ("Musketeers off - Cardinal & Rochefort", [3, 4], 6, "R", "(As the MUSKETEERS run off"),
 ]),
 dict(id="1.3", title="Mauriac - The Jolly Miller", roles={5: "Basille"}, cues=[
   ("Sabine & D'Artagnan arrive", [2, 1], 7, "L", "Scene 3"),
   ("Sabine off - Basille & Rochefort", [1, 5, 4], 7, "R", "BASILLE. (Laughing"),
   ("Milady enters - D'Artagnan out cold", [4, 9], 8, "L", "ROCHEFORT. Should I thank"),
   ("Milady & Rochefort off - Sabine back", [2, 1], 9, "L", "(MILADY EXITS. ROCHEFORT"),
 ]),
 dict(id="1.4", title="Treville's house", cues=[
   ("Treville, Aramis, Porthos", [10, 8, 7], 9, "L", "Scene4"),
   ("Athos enters", [10, 8, 7, 6], 10, "L", "I'm right here"),
   ("D'Artagnan at the door - Athos & Aramis muted", [10, 7, 1], 11, "L", "(As he shoos the musketeers"),
   ("Musketeers exit", [10, 1], 11, "L", "(ATHOS, PORTHOS and ARAMIS depart"),
 ]),
 dict(id="1.5", title="The street", roles={11: "Elise"}, cues=[
   ("D'Artagnan runs into Athos", [1, 6], 12, "L", "Scene 5"),
   ("Athos off - Porthos & Adele", [1, 7, 12], 13, "L", "(ATHOS EXITS. At the same"),
   ("Adele exits", [1, 7], 14, "L", "(ADELE laughs and walks off)"),
   ("Porthos off - Aramis & Elise", [1, 8, 11], 14, "L", "silvery laugh"),
   ("Aramis & Elise exit - D'Artagnan alone", [1], 15, "L", "(ARAMIS stamps his foot"),
   ("Sabine runs in", [1, 2], 15, "L", "(SABINE runs in.)"),
   ("Sabine off - Constance", [1, 13], 16, "L", "D'ARTAGNAN. Oh, I'm sorry!"),
   ("Rochefort enters", [1, 13, 4], 16, "L", "Here comes"),
   ("Rochefort staggers off", [1, 13], 16, "R", "D'ARTAGNAN. Are you all right?"),
 ]),
 dict(id="1.6", title="Royal Palace garden", cues=[
   ("King & Queen", [14, 15], 17, "R", "SCENE 6"),
   ("Cardinal enters", [14, 15, 3], 18, "L", "(At this moment CARDINAL RICHELIEU"),
   ("King exits", [15, 3], 18, "R", "(THE KING EXITS.)"),
   ("Constance enters", [15, 3, 13], 19, "L", "THE QUEEN. CONSTANCE!"),
   ("Rochefort enters", [15, 3, 13, 4], 19, "R", "(At which moment, we hear"),
   ("Queen & Constance exit", [3, 4], 20, "L", "I'm sorry to interrupt"),
 ]),
 dict(id="1.7", title="Behind the Luxembourg", cues=[
   ("D'Artagnan & Athos", [1, 6], 20, "R", "Lights Up Full Stage"),
   ("Porthos & Aramis enter", [1, 6, 7, 8], 21, "R", "(PORTHOS and ARAMIS ENTER.)"),
   ("Rochefort & guards enter", [1, 6, 7, 8, 4], 22, "L", "(They begin dueling in earnest"),
   ("Sabine enters the fight", [1, 6, 7, 8, 2], 23, "L", "As the battle warms up"),
 ]),
 dict(id="1.8", title="Tavern, then the street", roles={16: "Beggar"}, cues=[
   ("Tavern - Musketeers, D'Artagnan, Sabine", [6, 7, 8, 1, 2], 24, "R", "Lights Up Full Stage"),
   ("Blackout - transition to the street, all muted", [], 27, "R", "BLACKOUT"),
   ("Street - D'Artagnan & Beggar", [1, 16], 27, "R", "Out in the street"),
   ("Milady & Rochefort appear", [1, 16, 4, 9], 27, "R", "(And now MILADY and ROCHEFORT"),
 ]),
 dict(id="1.9", title="Cardinal's Palace", roles={9: "Sophie", 16: "DeBris"}, cues=[
   ("King & Cardinal", [14, 3], 28, "L", "Lights Up Full Stage"),
   ("King exits - Rochefort enters", [3, 4], 28, "L", "(The KING EXITS, his laughter"),
   ("D'Artagnan dragged in", [3, 4, 1], 29, "L", "cuttles out to the hall"),
   ("Cardinal exits", [4, 1], 30, "L", "(The CARDINAL EXITS through"),
   ("Rochefort off - Sophie (Milady) enters", [1, 9], 30, "L", "D'ARTAGNAN is alone and tries"),
   ("Cardinal (off) - \"Won't be a moment!\"", [1, 9, 3], 31, "L", "(And now we hear the CARDINAL"),
   ("Cardinal returns with Rochefort & DeBris", [3, 9, 4, 16], 31, "R", "(The door starts to open"),
   ("DeBris hauls D'Artagnan out", [3, 9, 4], 31, "R", "SOPHIE, the CARDINAL and ROCHEFORT are alone"),
 ]),
 dict(id="1.10", title="Palace courtyard", roles={16: "DeBris"}, cues=[
   ("DeBris drags D'Artagnan", [16, 1], 32, "R", "Scene 10"),
   ("Rochefort enters", [16, 1, 4], 32, "R", "(ROCHEFORT ENTERS.)"),
   ("Musketeers revealed - fight", [16, 1, 4, 7, 8, 6], 33, "L", "(DEBRIS pulls his sword"),
   ("Rochefort rushes off", [16, 1, 7, 8, 6], 33, "L", "(ARAMIS and PORTHOS"),
 ]),
 dict(id="1.11", title="Convent of the Sacred Heart", roles={11: "Sister", 9: "Sophie"}, cues=[
   ("Mother Superior & Sabine", [17, 2], 33, "R", "11"),
   ("Sister enters", [17, 2, 11], 33, "R", "(A SISTER ENTERS.)"),
   ("Sister off - Milady (as Sophie) enters", [17, 2, 9], 33, "R", "MILADY ENTERS"),
   ("Mother Superior exits", [2, 9], 34, "L", "(She EXITS.)"),
   ("Mother Superior re-enters", [2, 9, 17], 35, "L", "MOTHER SUPERIOR RE-ENTERS"),
   ("Voices off - Musketeers & D'Artagnan", [9, 6, 7, 8, 1], 35, "R", "voices offstage"),
   ("Milady runs out - Sabine revives", [6, 7, 8, 1, 2], 35, "R", "D'ARTAGNAN. Sabinel"),
 ]),
 dict(id="2.1", title="Montage, then the Royal Chamber",
      blackout=("Montage - music only, all muted", 37, "L", "CONSTANCE ushers BUCKINGHAM"), cues=[
   ("King & Cardinal (inserted page)", [14, 3], 38, "F", "Act 2"),
   ("King & Cardinal exit - all muted", [], 38, "F", "cardinal folless"),
   ("King & Cardinal off - Constance & Queen", [13, 15], 39, "R", "(The KING drags the CARDINAL"),
 ]),
 dict(id="2.2", title="Cardinal's Palace", roles={9: "Milady"}, cues=[
   ("Cardinal & Milady", [9, 3], 40, "L", "Scene 2"),
 ]),
 dict(id="2.3", title="The journey - Inn at Chantilly", cues=[
   ("Musketeers & D'Artagnan (handwritten lines)", [7, 8, 6, 1], 41, "L", "Scene 3"),
   ("D'Artagnan off - Innkeeper", [18, 7, 6, 8], 41, "R", "INNKEEPER. A glass of wine"),
   ("D'Artagnan enters", [18, 7, 6, 8, 1], 42, "L", "(THE MUSKETEERS are about to drink"),
 ]),
 dict(id="2.4", title="Buckingham's palace, London", roles={5: "Duke"}, cues=[
   ("Servant & Duke", [20, 5], 45, "L", "MIC"),
   ("Servant off - D'Artagnan enters", [5, 1], 45, "L", "D'ARTAGNAN. Your Grace."),
 ]),
 dict(id="2.5", title="The Royal Ball", roles={9: "Milady"}, cues=[
   ("Cardinal & Rochefort", [3, 4], 46, "L", "(The Royal Ball"),
   ("Milady arrives", [3, 4, 9], 46, "R", "(This last to MILADY"),
   ("Milady & Rochefort off - King enters", [3, 14], 47, "L", "(THE KING, wearing the mask"),
   ("King & Cardinal off - Constance & Sabine", [13, 2], 48, "L", "(She starts to go after him"),
   ("Queen enters - King & Cardinal return", [13, 15, 14, 3], 48, "L", "(CONSTANCE hurries to THE QUEEN"),
   ("Queen & Constance exit - Porthos calls the dance", [14, 3, 7], 49, "L", "(She and THE QUEEN EXIT"),
   ("Country dance - all muted", [], 49, "L", "Dance Everyone"),
   ("Queen re-enters - King counts; D'Artagnan, Sabine, Aramis, Porthos", [14, 15, 1, 2, 8, 7], 49, "L", "(A new piece of music strikes up"),
   ("King, Queen & Cardinal - the diamonds", [14, 15, 3], 51, "L", "THE KING. New"),
   ("Merlaison - Cardinal sweeps off", [14, 15], 51, "R", "(Music strikes up.)"),
 ]),
 dict(id="2.6", title="Outdoor terrace", roles={9: "Milady"}, cues=[
   ("Constance & D'Artagnan", [13, 1], 52, "L", "Scene 6"),
   ("Constance off - Milady enters", [1, 9], 52, "L", "(She hurries off, followed by"),
 ]),
 dict(id="2.7", title="Cardinal's Palace (La Rochelle cut)", roles={9: "Milady"}, cues=[
   ("Cardinal & Milady", [9, 3], 54, "L", "THE CARDINAL and MILADY in deep"),
 ]),
 dict(id="2.8", title="Milady & Athos", roles={9: "Milady"}, cues=[
   ("Cardinal off - Athos in the doorway", [9, 6], 55, "R", "MILADY gathers"),
   ("Porthos & Aramis (off)", [9, 6, 7, 8], 56, "R", "PORTHOS. (Off) Athos!"),
   ("Milady flees - Porthos & Aramis burst in", [6, 7, 8], 56, "R", "My dear fellow"),
 ]),
 dict(id="2.9", title="Carmelite Convent at Bethune", roles={9: "Milady", 11: "Sister"}, cues=[
   ("Milady, Sister, Constance", [9, 11, 13], 58, "R", "MILADY. No. No."),
   ("Sister off - Milady & Constance", [9, 13], 58, "R", "(She bustles out. MILADY"),
   ("D'Artagnan's voice (off)", [9, 13, 1], 61, "L", "moment, we hear a loud"),
   ("Into the closet - D'Artagnan, Sabine, Musketeers", [1, 8, 7, 6, 2], 61, "L", "(As MILADY and CONSTANCE disappear"),
   ("They rush out - Milady & Constance", [9, 13], 61, "L", "(All of them rush out"),
   ("Sabine in the doorway - fight", [9, 2], 61, "R", "to the door and opens it"),
   ("Everyone rushes in - Constance dies", [13, 1, 6, 7, 8, 2], 62, "L", "front door bursts open"),
 ]),
 dict(id="2.10", title="The Royal Garden - finale", cues=[
   ("King & Cardinal", [14, 3], 62, "R", "Scene 10"),
   ("D'Artagnan enters (Queen, Treville on)", [14, 3, 1, 15, 10], 62, "R", "for the better. (D'ARTAGNAN ENTERS"),
   ("Rochefort rushes in", [14, 3, 1, 15, 10, 4], 63, "L", "(ROCHEFORT rushes in."),
   ("Sabine & Musketeers rush in", [14, 3, 1, 15, 10, 4, 8, 6, 7, 2], 63, "L", "(SABINE, ATHOS, PORTHOS and ARAMIS rush in"),
   ("Cardinal & Rochefort exit - to the end", [14, 1, 15, 10, 8, 6, 7, 2], 64, "R", "(He whacks ROCHEFORT"),
 ]),
 # final cue: every mic muted and taken off its DCA
 dict(id="END", title="End of show", end=True,
      blackout=("End of show - all mics muted, DCAs cleared", 66, "L", "(Blackout.)"), cues=[]),
]

FULL_PAGES = {1, 38}          # pages that are a single upright sheet (not a two-page spread)


def norm(s):
    return " ".join(s.split())


def main():
    ocr = {p["page"]: p for p in json.load(open(OCR))}

    def find(page, side, text):
        lines = ocr[page]["lines"]
        cands = []
        for l in lines:
            cx = l["x"] + l["w"] / 2
            if side == "L" and cx >= 0.5: continue
            if side == "R" and cx < 0.5: continue
            if norm(text) in norm(l["t"]):
                cands.append(l)
        if not cands:
            raise SystemExit(f"anchor not found: p{page}{side} {text!r}")
        cands.sort(key=lambda l: l["y"])
        return cands[0]

    scenes_out, cues_out = [], []
    for sc in SCENES:
        roles = sc.get("roles", {})
        order = []
        for c in sc["cues"]:
            for m in c[1]:
                if m not in order:
                    order.append(m)
        assert len(order) <= 16, sc["id"]
        chars = []
        for i, m in enumerate(order):
            ch_name, dca_name = MICS[m]
            if m in roles:
                ch_name, dca_name = ROLE[roles[m]]
            chars.append(dict(mic=m, dca=i + 1, name=ch_name, dcaName=dca_name[:8]))
        act = scenes_out[-1]["act"] if sc.get("end") else int(sc["id"].split(".")[0])
        scenes_out.append(dict(id=sc["id"], act=act, title=sc["title"], chars=chars))
        # x.y.0 = blackout before the scene: DCAs are set up for the scene but every one is muted
        if "blackout" in sc:
            blabel, bpage, bside, btext = sc["blackout"]
            bl = find(bpage, bside, btext)
            by = bl["y"]
        else:
            _, _, bpage, bside, btext = sc["cues"][0]
            blabel = "Blackout - all muted"
            by = max(0.02, find(bpage, bside, btext)["y"] - 0.03)
        cues_out.append(dict(id=sc["id"] if sc.get("end") else f"{sc['id']}.0", scene=sc["id"], label=blabel, live=[], blackout=True,
                             page=bpage, side=bside, y=round(by, 4), x=0))
        for n, (label, live, page, side, text) in enumerate(sc["cues"], 1):
            for m in live:
                assert m in MICS, (sc["id"], m)
            l = find(page, side, text)
            cues_out.append(dict(id=f"{sc['id']}.{n}", scene=sc["id"], label=label, live=live,
                                 page=page, side=side, y=round(l["y"], 4), x=round(l["x"], 4)))

    # channel names used when a mic is not in the scene
    mics = [dict(mic=m, name=v[0]) for m, v in sorted(MICS.items())]
    show = dict(title="The Three Musketeers", mics=mics, scenes=scenes_out, cues=cues_out,
                fullPages=sorted(FULL_PAGES), pageCount=len(ocr))
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    json.dump(show, open(OUT_JSON, "w"), indent=1)
    print(f"{len(scenes_out)} scenes, {len(cues_out)} cues -> {OUT_JSON}")

    if "--no-pdf" not in sys.argv:
        mark_pdf(show)


# ---------------------------------------------------------------- PDF marking
def pdf_str(s):
    s = s.replace("’", "'")
    out = ""
    for ch in s:
        if ch in "()\\": out += "\\" + ch
        elif ord(ch) < 128: out += ch
        else: out += "?"
    return "(" + out + ")"


def text_width(s, size, bold=False):
    # close-enough Helvetica metrics for laying out the labels
    return len(s) * size * (0.56 if bold else 0.50)


def mark_pdf(show):
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import (DictionaryObject, NameObject, NumberObject, DecodedStreamObject,
                               ArrayObject, FloatObject)
    reader = PdfReader(SRC_PDF)
    writer = PdfWriter()
    for p in reader.pages:
        writer.add_page(p)

    names = {m["mic"]: m["name"] for m in show["mics"]}
    scenes = {s["id"]: s for s in show["scenes"]}
    by_page = {}
    prev_live, prev_scene = [], None
    for c in show["cues"]:
        sc = scenes[c["scene"]]
        nm = {ch["mic"]: ch["dcaName"] for ch in sc["chars"]}
        dca = {ch["mic"]: ch["dca"] for ch in sc["chars"]}
        first = c["scene"] != prev_scene
        if not sc["chars"]:
            detail, detail2 = "ALL MICS MUTED - OFF THEIR DCAs", ""
        elif first:
            detail = "DCA: " + "  ".join(f"{ch['dca']}={ch['dcaName']}" for ch in sc["chars"])
            detail2 = "BLACKOUT - ALL MUTED" if c.get("blackout") else "LIVE: " + ", ".join(nm[m] for m in c["live"])
        else:
            on = [m for m in c["live"] if m not in prev_live]
            off = [m for m in prev_live if m not in c["live"]]
            parts = []
            if on: parts.append("UNMUTE " + ", ".join(f"{nm[m]} (D{dca[m]})" for m in on))
            if off: parts.append("MUTE " + ", ".join(f"{nm[m]} (D{dca[m]})" for m in off))
            detail, detail2 = "   ".join(parts), ""
        by_page.setdefault(c["page"], []).append((c, detail, detail2))
        prev_live, prev_scene = c["live"], c["scene"]

    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica-Bold")})
    font_ref = writer._add_object(font)
    gs = DictionaryObject({NameObject("/Type"): NameObject("/ExtGState"), NameObject("/ca"): FloatObject(0.88)})
    gs_ref = writer._add_object(gs)

    for i, page in enumerate(writer.pages):
        pno = i + 1
        full = pno in FULL_PAGES
        W, H = float(page.mediabox.width), float(page.mediabox.height)
        if not full:
            page[NameObject("/Rotate")] = NumberObject(270)     # show the spread upright
        cues = by_page.get(pno)
        if not cues:
            continue
        # upright frame: UW x UH points, origin top-left
        UW, UH = (W, H) if full else (H, W)
        ops = ["q"]
        if full:
            ops.append(f"1 0 0 -1 0 {H:.2f} cm")                 # (u, v) top-left origin -> pdf
        else:
            ops.append(f"0 -1 -1 0 {W:.2f} {H:.2f} cm")          # upright (u,v) -> x=W-v, y=H-u
        R = "0.85 0.05 0.1"
        for c, detail, detail2 in cues:
            if full:
                x0, x1 = 0.06 * UW, 0.94 * UW
            elif c["side"] == "L":
                x0, x1 = 0.035 * UW, 0.485 * UW
            else:
                x0, x1 = 0.515 * UW, 0.965 * UW
            y = c["y"] * UH - 3.5
            label = c["id"]
            lw = text_width(label, 9, True) + 6
            # line across the column
            ops.append(f"{R} RG 0.9 w {x0:.2f} {y:.2f} m {x1:.2f} {y:.2f} l S")
            # label tab sitting on the line at the left
            ops.append(f"/GSm gs {R} rg {x0:.2f} {y - 11:.2f} {lw:.2f} 11 re f")
            ops.append(text_op(x0 + 3, y - 2.6, 9, "1 1 1", label))
            # detail text, white-backed, just right of the tab
            tx = x0 + lw + 3
            for k, d in enumerate([detail, detail2]):
                if not d: continue
                size = 5.6
                maxw = x1 - tx
                while text_width(d, size) > maxw and size > 3.6:
                    size -= 0.2
                yy = y - 1.6 - (1 - k) * 0 - (0 if k == 1 or not detail2 else 6.2)
                ops.append(f"/GSm gs 1 1 1 rg {tx - 1:.2f} {yy - size:.2f} {min(text_width(d, size) + 3, maxw + 1):.2f} {size + 1.2:.2f} re f")
                ops.append(text_op(tx, yy, size, R, d))
        ops.append("Q")
        stream = DecodedStreamObject()
        stream.set_data(("\n".join(ops)).encode("latin-1"))
        sref = writer._add_object(stream)

        res = page.get("/Resources")
        res = res.get_object() if res is not None else DictionaryObject()
        if "/Font" not in res: res[NameObject("/Font")] = DictionaryObject()
        res["/Font"].get_object()[NameObject("/FMic")] = font_ref
        if "/ExtGState" not in res: res[NameObject("/ExtGState")] = DictionaryObject()
        res["/ExtGState"].get_object()[NameObject("/GSm")] = gs_ref
        page[NameObject("/Resources")] = res

        # isolate the original content, then draw ours on top
        qo = DecodedStreamObject(); qo.set_data(b"q\n")
        qc = DecodedStreamObject(); qc.set_data(b"\nQ\n")
        old = page["/Contents"].get_object() if "/Contents" in page else None
        arr = ArrayObject([writer._add_object(qo)])
        if isinstance(old, ArrayObject):
            arr.extend(old)
        elif old is not None:
            arr.append(page.raw_get("/Contents"))
        arr.append(writer._add_object(qc))
        arr.append(sref)
        page[NameObject("/Contents")] = arr

    with open(OUT_PDF, "wb") as f:
        writer.write(f)
    print("marked PDF ->", OUT_PDF)


def text_op(x, y, size, rgb, s):
    # the page matrix flips y, so flip the text back upright
    return f"BT /FMic {size:.1f} Tf {rgb} rg 1 0 0 -1 {x:.2f} {y:.2f} Tm {pdf_str(s)} Tj ET"


if __name__ == "__main__":
    main()
