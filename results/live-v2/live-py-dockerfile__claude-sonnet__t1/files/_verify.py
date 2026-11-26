import threading
import time
import urllib.request

import app

server = app.ThreadingHTTPServer(("127.0.0.1", 8000), app.Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
time.sleep(0.3)

with urllib.request.urlopen("http://127.0.0.1:8000/") as resp:
    status = resp.status
    body = resp.read()

server.shutdown()
server.server_close()

print("status", status)
print("body", body)
assert status == 200
assert body == b"ok"
print("VERIFIED OK")
