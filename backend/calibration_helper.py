        # Fetch real historical hourly weather for calibration
        df = None
        for past_days in [7, 3]:
            try:
                url = (
                    f"https://api.open-meteo.com/v1/forecast?"
                    f"latitude={lat}&longitude={lon}&past_days={past_days}&"
                    f"hourly=temperature_2m,relative_humidity_2m,surface_pressure&forecast_days=1"
                )
                async with httpx.AsyncClient(verify=False, timeout=8.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        hourly = data.get("hourly", {})
                        times = hourly.get("time", [])
                        temps = hourly.get("temperature_2m", [])
                        press = hourly.get("surface_pressure", [])
                        hums  = hourly.get("relative_humidity_2m", [])
                        if temps and len(temps) >= 24:
                            df = pd.DataFrame({
                                "timestamp": pd.to_datetime(times),
                                "temperature": pd.Series(temps).ffill().bfill(),
                                "pressure": pd.Series(press).ffill().bfill(),
                                "humidity": pd.Series(hums).ffill().bfill()
                            })
                            print(f"[Pipeline] Successfully fetched {len(df)} real hourly observations from Open-Meteo.")
                            break
            except Exception as e:
                print(f"[Pipeline] Attempt with past_days={past_days} failed: {e}")

        # Fallback if Open-Meteo is temporarily 502 or unreachable
        if df is None:
            print("[Pipeline] Open-Meteo historical API busy/502. Synthesizing station baseline anchored to live station coordinates.")
            # Fetch current live reading to anchor baseline
            curr_temp, curr_pres, curr_hum = 25.0, 1012.0, 55.0
            try:
                cur_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,surface_pressure"
                async with httpx.AsyncClient(verify=False, timeout=4.0) as client:
                    cur_resp = await client.get(cur_url)
                    if cur_resp.status_code == 200:
                        cur_data = cur_resp.json().get("current", {})
                        curr_temp = float(cur_data.get("temperature_2m", curr_temp))
                        curr_pres = float(cur_data.get("surface_pressure", curr_pres))
                        curr_hum = float(cur_data.get("relative_humidity_2m", curr_hum))
            except Exception:
                pass

            # Generate 168 hours (7 days) centered around real live readings
            hours = 168
            timestamps = pd.date_range(end=pd.Timestamp.now(), periods=hours, freq="h")
            h_idx = np.arange(hours)
            diurnal = 6.0 * np.sin((h_idx - 10) * np.pi / 12.0)
            temps = curr_temp + diurnal + np.random.normal(0, 0.4, hours)
            hums = np.clip(curr_hum - 1.5 * diurnal + np.random.normal(0, 1.2, hours), 10, 100)
            press = curr_pres + 1.5 * np.sin(2 * np.pi * h_idx / 24.0) + np.random.normal(0, 0.3, hours)

            df = pd.DataFrame({
                "timestamp": timestamps,
                "temperature": np.round(temps, 3),
                "pressure": np.round(press, 3),
                "humidity": np.round(hums, 3)
            })

