#!/usr/bin/env python3
"""Seed sample charging stations for local development without NDW sync."""

from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Connector, Evse, Station

SAMPLES = [
    {
        "id": "NL:TST:AMS001",
        "country_code": "NL",
        "party_id": "TST",
        "location_id": "AMS001",
        "name": "Amsterdam Centraal",
        "address": "Stationsplein 9",
        "city": "Amsterdam",
        "latitude": 52.3791,
        "longitude": 4.9003,
        "operator_name": "FastCharge NL",
        "owner_name": "NS",
        "parking_type": "ON_STREET",
        "facilities": ["WIFI"],
        "publish": True,
        "access_class": "public",
        "evses": [
            {
                "id": "NL:TST:AMS001:E1",
                "evse_uid": "E1",
                "status": "AVAILABLE",
                "connectors": [
                    {
                        "id": "NL:TST:AMS001:E1:C1",
                        "connector_id": "C1",
                        "standard": "IEC_62196_T2_COMBO",
                        "max_power_kw": 150.0,
                        "resolved_energy_price": 0.45,
                        "resolved_currency": "EUR",
                    }
                ],
            }
        ],
    },
    {
        "id": "NL:TST:UTR001",
        "country_code": "NL",
        "party_id": "TST",
        "location_id": "UTR001",
        "name": "Utrecht CS",
        "address": "Moreelsepark 3",
        "city": "Utrecht",
        "latitude": 52.0893,
        "longitude": 5.1106,
        "operator_name": "GreenWatt",
        "owner_name": None,
        "parking_type": "PARKING_GARAGE",
        "facilities": [],
        "publish": True,
        "access_class": "semi-public",
        "evses": [
            {
                "id": "NL:TST:UTR001:E1",
                "evse_uid": "E1",
                "status": "AVAILABLE",
                "connectors": [
                    {
                        "id": "NL:TST:UTR001:E1:C1",
                        "connector_id": "C1",
                        "standard": "IEC_62196_T2",
                        "max_power_kw": 22.0,
                        "resolved_energy_price": 0.32,
                        "resolved_currency": "EUR",
                    }
                ],
            }
        ],
    },
    {
        "id": "NL:TST:ROT001",
        "country_code": "NL",
        "party_id": "TST",
        "location_id": "ROT001",
        "name": "Rotterdam Haven",
        "address": "Wilhelminakade 909",
        "city": "Rotterdam",
        "latitude": 51.9025,
        "longitude": 4.4653,
        "operator_name": "Shell Recharge",
        "owner_name": "Shell",
        "parking_type": "ON_STREET",
        "facilities": ["RESTAURANT"],
        "publish": True,
        "access_class": "public",
        "evses": [
            {
                "id": "NL:TST:ROT001:E1",
                "evse_uid": "E1",
                "status": "CHARGING",
                "connectors": [
                    {
                        "id": "NL:TST:ROT001:E1:C1",
                        "connector_id": "C1",
                        "standard": "IEC_62196_T2_COMBO",
                        "max_power_kw": 50.0,
                        "resolved_energy_price": 0.55,
                        "resolved_currency": "EUR",
                    }
                ],
            }
        ],
    },
]


def main():
    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(engine)
    now = datetime.now(timezone.utc)

    with Session() as session:
        for s in SAMPLES:
            station = session.get(Station, s["id"])
            if not station:
                station = Station(id=s["id"])
                session.add(station)
            station.country_code = s["country_code"]
            station.party_id = s["party_id"]
            station.location_id = s["location_id"]
            station.name = s["name"]
            station.address = s["address"]
            station.city = s["city"]
            station.latitude = s["latitude"]
            station.longitude = s["longitude"]
            station.geom = f"SRID=4326;POINT({s['longitude']} {s['latitude']})"
            station.operator_name = s["operator_name"]
            station.owner_name = s["owner_name"]
            station.parking_type = s["parking_type"]
            station.facilities = s["facilities"]
            station.publish = s["publish"]
            station.access_class = s["access_class"]
            station.last_updated = now
            station.fetched_at = now

            for evse_data in s["evses"]:
                evse = session.get(Evse, evse_data["id"])
                if not evse:
                    evse = Evse(id=evse_data["id"], station_id=s["id"])
                    session.add(evse)
                evse.evse_uid = evse_data["evse_uid"]
                evse.status = evse_data["status"]
                evse.last_updated = now

                for conn_data in evse_data["connectors"]:
                    conn = session.get(Connector, conn_data["id"])
                    if not conn:
                        conn = Connector(
                            id=conn_data["id"],
                            evse_id=evse_data["id"],
                            station_id=s["id"],
                        )
                        session.add(conn)
                    conn.connector_id = conn_data["connector_id"]
                    conn.standard = conn_data["standard"]
                    conn.max_power_kw = conn_data["max_power_kw"]
                    conn.tariff_ids = []
                    conn.country_code = s["country_code"]
                    conn.party_id = s["party_id"]
                    conn.resolved_energy_price = conn_data["resolved_energy_price"]
                    conn.resolved_currency = conn_data["resolved_currency"]

        session.commit()
    print(f"Seeded {len(SAMPLES)} sample stations")


if __name__ == "__main__":
    main()
