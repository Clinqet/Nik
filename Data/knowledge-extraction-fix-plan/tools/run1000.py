"""A CLEAN cap-1000 measurement: fresh document, stable build, timed from push."""
import sys, os, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import api, adminapi
from api import call, put_blob

TREAT = ["Classic Facial","Hydrating Facial","Anti Ageing Facial","Brightening Facial","Acne Clear Facial",
         "Gold Facial","Pearl Facial","Fruit Facial","Collagen Facial","Vitamin C Facial","Oxygen Facial",
         "Full Arm Wax","Half Arm Wax","Full Leg Wax","Half Leg Wax","Underarm Wax","Bikini Wax",
         "Eyebrow Threading","Upper Lip Threading","Chin Threading","Forehead Threading","Full Face Threading",
         "Gel Manicure","Classic Manicure","Spa Pedicure","Classic Pedicure","Nail Art Set","Acrylic Set",
         "Lash Lift","Lash Extension Full","Lash Extension Refill","Brow Lamination","Brow Tint","Lash Tint",
         "Head Massage","Shoulder Massage","Full Body Massage","Foot Reflexology","Hot Stone Massage",
         "Hair Cut","Blow Dry","Root Touch Up","Full Colour","Balayage Foils","Keratin Treatment",
         "Deep Conditioning","Scalp Treatment","Bridal Trial","Bridal Package","Party Makeup"]
LEVEL = ["Express","Standard","Deluxe","Signature","Premium","Student","Senior","Weekday","Weekend","Member",
         "Junior Stylist","Senior Stylist","Director","Off Peak","Peak","Loyalty","First Visit","Trio Package",
         "Six Package","Gift Card"]
lines, n = ["Treatment,Price"], 0
for t in TREAT:
    for lv in LEVEL:
        n += 1
        if n > 1000: break
        lines.append("%s %s,$%d" % (t, lv, 20 + n))
    if n > 1000: break
BODY = ("\r\n".join(lines) + "\r\n").encode()
print("CLEAN cap-1000 run: %d priced lines | extractor %d batches, judge %d batches"
      % (n, (n + 49) // 50, (n + 99) // 100), flush=True)

st, b = call("POST", "/knowledge/documents/sas-urls", {"files": [{
    "fileName": "x07_clean1000.csv", "contentType": "text/csv", "fileSize": len(BODY)}]})
u = b["data"]["uploadUrls"][0]
put_blob(u["uploadUrl"], BODY, "text/csv")
call("POST", "/knowledge/documents/confirm", {"files": [{
    "docId": u["docId"], "blobName": u["blobName"], "fileName": "x07_clean1000.csv",
    "contentType": "text/csv", "fileSize": len(BODY), "docType": "PriceList",
    "receptionistAccess": "AnswersAndSends"}]})
print("pushed:", u["docId"], flush=True)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "clean1000_docid.txt"), "w").write(u["docId"])
start = time.time()

for i in range(170):
    time.sleep(20)
    s, rb = call("GET", "/knowledge/documents?page=1&pageSize=50")
    if not isinstance(rb, dict):
        continue
    r = next((x for x in rb["data"]["documents"] if x["docId"] == u["docId"]), None)
    if r is None:
        print("row GONE", flush=True); break
    a = r.get("serviceDraftAnalytics") or {}
    out = a.get("outcome")
    mins = (time.time() - start) / 60
    if out not in (None, "", "Queued", "Running"):
        print("\nSETTLED in %.1f min -> outcome=%s candidates=%s drafts=%s notFullyScanned=%s judgeRemoved=%s"
              % (mins, out, a.get("candidateCount"), a.get("draftCount"),
                 a.get("notFullyScanned"), a.get("judgeRemovedCount")), flush=True)
        print("failureReason:", a.get("failureReason"), flush=True)
        break
    if i % 6 == 0:
        print("  %.0f min: %s / %s" % (mins, r.get("status"), out), flush=True)
else:
    print("not settled after 56 min", flush=True)
