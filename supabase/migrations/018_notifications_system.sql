-- ============================================================================
-- BISO INVEST — MIGRATION 018 : SYSTÈME DE NOTIFICATIONS INTERNES
-- ============================================================================
-- Alertes automatiques quand :
--   1. Un bénéfice journalier est disponible (type: 'profit')
--   2. Un nouveau filleul rejoint l'équipe (type: 'referral')
--   3. Un retrait est approuvé (type: 'withdrawal')
-- ============================================================================

-- 1. Colonne reference_id pour l'idempotence des notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Index unique partiel : empêche les doublons (type + référence + user)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_user_type_ref
  ON notifications (user_id, type, reference_id)
  WHERE reference_id IS NOT NULL;


-- ============================================================================
-- 2. FONCTION HELPER : inserer une notification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_type VARCHAR(50),
  p_title VARCHAR(150),
  p_message TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, reference_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_reference_id)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ============================================================================
-- 3. TRIGGER : Nouveau filleul → notification au parent
-- ============================================================================
CREATE OR REPLACE FUNCTION public.on_new_referral_notify()
RETURNS trigger AS $$
DECLARE
  v_parent_id UUID := NEW.parent_id;
  v_child_name VARCHAR;
  v_child_phone VARCHAR;
  v_level_label VARCHAR;
BEGIN
  IF v_parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT display_name, phone INTO v_child_name, v_child_phone
  FROM profiles WHERE id = NEW.child_id;

  v_level_label := CASE NEW.level
    WHEN 'A' THEN 'direct'
    WHEN 'B' THEN 'niveau 2'
    WHEN 'C' THEN 'niveau 3'
    WHEN 'D' THEN 'niveau 4'
    ELSE 'votre réseau'
  END;

  PERFORM public.notify_user(
    v_parent_id,
    'referral',
    'Nouveau membre dans votre équipe',
    COALESCE(v_child_name, v_child_phone, 'Un utilisateur')
      || ' a rejoint votre réseau (' || v_level_label || ').',
    NEW.child_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_notify_new_referral ON referrals;
CREATE TRIGGER trg_notify_new_referral
  AFTER INSERT ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_referral_notify();


-- ============================================================================
-- 4. TRIGGER : Retrait approuvé → notification à l'utilisateur
-- ============================================================================
CREATE OR REPLACE FUNCTION public.on_withdrawal_approved_notify()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'PAYE' AND (OLD.status IS DISTINCT FROM 'PAYE') THEN
    PERFORM public.notify_user(
      NEW.user_id,
      'withdrawal',
      'Retrait approuvé',
      'Votre retrait de '
        || TO_CHAR(NEW.net_amount, 'FM999G999G990') || ' FC via '
        || NEW.network || ' a été validé et versé.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_notify_withdrawal_approved ON withdrawals;
CREATE TRIGGER trg_notify_withdrawal_approved
  AFTER UPDATE ON withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.on_withdrawal_approved_notify();


-- ============================================================================
-- 5. RPC : Synchroniser les notifications de bénéfices disponibles
-- ============================================================================
-- Appelé côté client au chargement du dashboard.
-- Pour chaque investissement actif du jour sans profit_claims, insère une
-- notification de type 'profit'. Idempotent via l'index unique.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_profit_notifications()
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_inv RECORD;
  v_has_claim BOOLEAN;
  v_inserted INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  FOR v_inv IN
    SELECT i.id, i.monthly_return, i.created_at, i.duration_months
    FROM investments i
    WHERE i.user_id = v_user_id
      AND i.status = 'ACTIVE'
      AND (i.created_at + (i.duration_months * INTERVAL '1 month')) > NOW()
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM profit_claims pc
      WHERE pc.investment_id = v_inv.id
        AND pc.profit_date = current_date
    ) INTO v_has_claim;

    IF NOT v_has_claim THEN
      INSERT INTO notifications (user_id, type, title, message, reference_id)
      VALUES (
        v_user_id,
        'profit',
        'Bénéfice disponible',
        'Votre bénéfice journalier est prêt à être vendu. Cliquez sur VENDRE.',
        v_inv.id
      )
      ON CONFLICT (user_id, type, reference_id) DO NOTHING;

      IF FOUND THEN
        v_inserted := v_inserted + 1;
      END IF;
    END IF;
  END LOOP;

  -- Nettoyage des anciennes notifications profit (>7 jours)
  DELETE FROM notifications
  WHERE user_id = v_user_id
    AND type = 'profit'
    AND created_at < (NOW() - INTERVAL '7 days');

  RETURN json_build_object(
    'success', true,
    'new_notifications', v_inserted
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.sync_profit_notifications() TO authenticated;


-- ============================================================================
-- 6. RPC : Marquer toutes les notifications comme lues
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = auth.uid()
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated;
