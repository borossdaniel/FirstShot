import threading
import time
import urllib.request
from http.server import HTTPServer
from app import Handler

server = HTTPServer(("127.0.0.1", 8000), Handler)
t = threading.Thread(target=server.serve_forever, daemon=True)
t.start()
time.sleep(0.5)

resp = urllib.request.urlopen("http://127.0.0.1:8000/")
print("STATUS", resp.status)
print("BODY", resp.read())

server.shutdown()
