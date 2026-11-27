import threading
import time
import urllib.request
import importlib.util

spec = importlib.util.spec_from_file_location("app", "app.py")
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

from http.server import ThreadingHTTPServer

server = ThreadingHTTPServer(("127.0.0.1", 8000), app.Handler)
t = threading.Thread(target=server.serve_forever, daemon=True)
t.start()
time.sleep(0.5)

resp = urllib.request.urlopen("http://127.0.0.1:8000/")
print("status:", resp.status)
print("body:", resp.read())

server.shutdown()
