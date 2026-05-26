import os
import sqlite3
import random
from flask import Flask, send_from_directory, request, jsonify

app = Flask(__name__, static_folder='.', static_url_path='')

DATABASE = 'travelai.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# Helper to ensure database is initialized on startup
def check_db():
    if not os.path.exists(DATABASE):
        import init_db
        init_db.init_db()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# --- API ENDPOINTS ---

@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM bookings ORDER BY id DESC")
        rows = cursor.fetchall()
        conn.close()
        
        bookings = [dict(row) for row in rows]
        return jsonify(bookings), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        required_fields = ['first_name', 'last_name', 'email', 'phone', 'destination', 'duration', 'total_price', 'card_number', 'travel_date']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Generate booking reference TAI-XXXXX
        ref = f"TAI-{random.randint(10000, 99999)}"
        status = data.get('status', 'Pending')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO bookings 
        (booking_ref, first_name, last_name, email, phone, destination, duration, total_price, status, card_number, travel_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ref,
            data['first_name'],
            data['last_name'],
            data['email'],
            data['phone'],
            data['destination'],
            data['duration'],
            float(data['total_price']),
            status,
            data['card_number'],
            data['travel_date']
        ))
        conn.commit()
        
        # Get inserted booking
        booking_id = cursor.lastrowid
        cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
        new_booking = dict(cursor.fetchone())
        conn.close()
        
        return jsonify(new_booking), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/bookings/<int:booking_id>', methods=['PUT'])
def update_booking(booking_id):
    try:
        data = request.json
        if not data or 'status' not in data:
            return jsonify({"error": "Status field is required"}), 400
        
        status = data['status']
        if status not in ['Pending', 'Approved', 'Cancelled']:
            return jsonify({"error": "Invalid status value"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE bookings SET status = ? WHERE id = ?", (status, booking_id))
        conn.commit()
        
        # Check if booking exists
        cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({"error": "Booking not found"}), 404
            
        return jsonify(dict(row)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/bookings/<int:booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if booking exists
        cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return jsonify({"error": "Booking not found"}), 404
            
        cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
        conn.commit()
        conn.close()
        
        return jsonify({"message": f"Booking {booking_id} successfully deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/bookings/seed', methods=['POST'])
def seed_more_bookings():
    try:
        destinations = [
            ("Paris, France", "5 Days, 4 Nights", 966.00),
            ("Rome, Italy", "4 Days, 3 Nights", 899.00),
            ("Bali, Indonesia", "7 Days, 6 Nights", 1250.00),
            ("Tokyo, Japan", "6 Days, 5 Nights", 1499.00),
            ("New York, USA", "5 Days, 4 Nights", 1150.00)
        ]
        first_names = ["Hamza", "Zainab", "Ali", "Ayesha", "Fatima", "Sarah", "Bilal", "Usman", "Maria"]
        last_names = ["Khan", "Rehman", "Ali", "Sheikh", "Siddiqui", "Doe", "Hashmi", "Malik"]
        statuses = ["Confirmed", "Pending", "Cancelled"]
        
        from datetime import datetime, timedelta
        now = datetime.now()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        seeded = []
        for _ in range(5):
            dest, dur, price = random.choice(destinations)
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            email = f"{fn.lower()}.{ln.lower()}@example.com"
            phone = f"+92 (300) {random.randint(1000000, 9999999)}"
            ref = f"TAI-{random.randint(10000, 99999)}"
            status = random.choice(statuses)
            travel_date = (now + timedelta(days=random.randint(10, 60))).strftime("%Y-%m-%d")
            card = f"**** **** **** {random.randint(1000, 9999)}"
            
            cursor.execute('''
            INSERT INTO bookings 
            (booking_ref, first_name, last_name, email, phone, destination, duration, total_price, status, card_number, travel_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (ref, fn, ln, email, phone, dest, dur, price, status, card, travel_date))
            
            seeded.append(ref)
            
        conn.commit()
        conn.close()
        
        return jsonify({"message": "Successfully seeded 5 random bookings!", "seeded_refs": seeded}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    check_db()
    print("Starting TravelAI local Flask server on http://127.0.0.1:8000 ...")
    app.run(host='127.0.0.1', port=8000, debug=True)
