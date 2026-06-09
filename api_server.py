from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import sqlite3
import re
import urllib.parse
import random
import string

DB_PATH = 'bookings.db'


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_ref TEXT,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        destination TEXT,
        duration TEXT,
        travel_date TEXT,
        total_price REAL,
        card_number TEXT,
        status TEXT
    )
    ''')
    conn.commit()
    conn.close()


def row_to_dict(row):
    keys = ['id','booking_ref','first_name','last_name','email','phone','destination','duration','travel_date','total_price','card_number','status']
    return {k: row[i] for i,k in enumerate(keys)}


def mask_card(card):
    s = str(card)
    if len(s) >= 4:
        return '**** **** **** ' + s[-4:]
    return '****'


class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path.startswith('/api/bookings'):
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT id,booking_ref,first_name,last_name,email,phone,destination,duration,travel_date,total_price,card_number,status FROM bookings ORDER BY id DESC')
            rows = c.fetchall()
            conn.close()
            data = [row_to_dict(r) for r in rows]
            self._set_headers(200)
            self.wfile.write(json.dumps(data).encode('utf-8'))
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({'error':'Not found'}).encode('utf-8'))

    def do_POST(self):
        if self.path == '/api/bookings/seed':
            # Insert some mock bookings
            samples = [
                {
                    'first_name':'Aisha','last_name':'Khan','email':'aisha@example.com','phone':'+1234567890',
                    'destination':'Kyoto, Japan','duration':'5 days','travel_date':'2026-09-15','total_price':1299.99,'card_number':'4111111111111111','status':'Pending'
                },
                {
                    'first_name':'Omar','last_name':'Ali','email':'omar@example.com','phone':'+1987654321',
                    'destination':'Lisbon, Portugal','duration':'7 days','travel_date':'2026-07-22','total_price':1899.50,'card_number':'5555555555554444','status':'Confirmed'
                },
                {
                    'first_name':'Sara','last_name':'Mirza','email':'sara@example.com','phone':'+447700900123',
                    'destination':'Cappadocia, Turkey','duration':'4 days','travel_date':'2026-08-02','total_price':899.00,'card_number':'4012888888881881','status':'Cancelled'
                }
            ]
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            for s in samples:
                ref = 'TAI' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                c.execute('INSERT INTO bookings (booking_ref,first_name,last_name,email,phone,destination,duration,travel_date,total_price,card_number,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                          (ref,s['first_name'],s['last_name'],s['email'],s['phone'],s['destination'],s['duration'],s['travel_date'],s['total_price'],mask_card(s['card_number']),s['status']))
            conn.commit()
            conn.close()
            self._set_headers(200)
            self.wfile.write(json.dumps({'message':'Seeded mock bookings'}).encode('utf-8'))
            return

        if self.path == '/api/bookings':
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length) if length > 0 else b'{}'
            print('Received raw POST /api/bookings:', raw)
            payload = json.loads(raw.decode('utf-8') or '{}')
            print('Parsed payload:', payload)
            # Required booking fields (payment optional)
            required = ['first_name','last_name','email','phone','destination','duration','travel_date']
            if not all(k in payload for k in required):
                self._set_headers(400)
                self.wfile.write(json.dumps({'error':'Missing required booking fields'}).encode('utf-8'))
                return

            # Payment fields are optional for demo mode
            total_price = float(payload.get('total_price', 0.0))
            card_raw = payload.get('card_number')
            card_masked = None
            if card_raw:
                # If client already sent masked value, keep it; otherwise mask last4
                if isinstance(card_raw, str) and '****' in card_raw:
                    card_masked = card_raw
                else:
                    s = str(card_raw).replace(' ', '')
                    card_masked = mask_card(s)

            ref = 'TAI' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('INSERT INTO bookings (booking_ref,first_name,last_name,email,phone,destination,duration,travel_date,total_price,card_number,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                      (ref,payload['first_name'],payload['last_name'],payload['email'],payload['phone'],payload['destination'],payload['duration'],payload['travel_date'],total_price,card_masked or 'N/A','Pending'))
            conn.commit()
            new_id = c.lastrowid
            c.execute('SELECT id,booking_ref,first_name,last_name,email,phone,destination,duration,travel_date,total_price,card_number,status FROM bookings WHERE id=?',(new_id,))
            row = c.fetchone()
            conn.close()
            self._set_headers(201)
            self.wfile.write(json.dumps(row_to_dict(row)).encode('utf-8'))
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({'error':'Not found'}).encode('utf-8'))

    def do_PUT(self):
        m = re.match(r'^/api/bookings/(\d+)$', self.path)
        if m:
            bid = int(m.group(1))
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length) if length > 0 else b'{}'
            payload = json.loads(raw.decode('utf-8') or '{}')
            if 'status' not in payload:
                self._set_headers(400)
                self.wfile.write(json.dumps({'error':'Missing status field'}).encode('utf-8'))
                return
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('UPDATE bookings SET status=? WHERE id=?',(payload['status'],bid))
            conn.commit()
            c.execute('SELECT id,booking_ref,first_name,last_name,email,phone,destination,duration,travel_date,total_price,card_number,status FROM bookings WHERE id=?',(bid,))
            row = c.fetchone()
            conn.close()
            if not row:
                self._set_headers(404)
                self.wfile.write(json.dumps({'error':'Booking not found'}).encode('utf-8'))
                return
            self._set_headers(200)
            self.wfile.write(json.dumps(row_to_dict(row)).encode('utf-8'))
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({'error':'Not found'}).encode('utf-8'))

    def do_DELETE(self):
        m = re.match(r'^/api/bookings/(\d+)$', self.path)
        if m:
            bid = int(m.group(1))
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('DELETE FROM bookings WHERE id=?',(bid,))
            deleted = c.rowcount
            conn.commit()
            conn.close()
            if deleted == 0:
                self._set_headers(404)
                self.wfile.write(json.dumps({'error':'Booking not found'}).encode('utf-8'))
                return
            self._set_headers(200)
            self.wfile.write(json.dumps({'message':'Deleted'}).encode('utf-8'))
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({'error':'Not found'}).encode('utf-8'))


def run(server_class=ThreadingHTTPServer, handler_class=Handler, port=5000):
    init_db()
    server_address = ('127.0.0.1', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting API server on http://{server_address[0]}:{server_address[1]}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('Shutting down')
        httpd.server_close()


if __name__ == '__main__':
    run()
