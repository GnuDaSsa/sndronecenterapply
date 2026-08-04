CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  dept text NOT NULL,
  reserver_name text NOT NULL,
  ext text NOT NULL,
  pw_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reservation_hours (
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  date date NOT NULL,
  hour smallint NOT NULL CHECK (hour >= 6 AND hour <= 22),
  PRIMARY KEY (date, hour)
);

CREATE INDEX reservation_hours_reservation_id_idx ON public.reservation_hours(reservation_id);
CREATE INDEX reservations_date_idx ON public.reservations(date);

GRANT ALL ON public.reservations TO service_role;
GRANT ALL ON public.reservation_hours TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_hours ENABLE ROW LEVEL SECURITY;