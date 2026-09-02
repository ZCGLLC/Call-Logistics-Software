import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

export default function () {
  const res = http.get(`${__ENV.API_PUBLIC_URL ?? "http://localhost:4000"}/api/v1/health/live`);
  check(res, { "live 200": (r) => r.status === 200 });
}
