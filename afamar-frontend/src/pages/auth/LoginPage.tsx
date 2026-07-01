import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ username, password });
      navigate("/admin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.login}>
      <div className={styles.login__card}>
        <div className={styles.login__logo}>
          <h1>AFAMAR</h1>
          <p>Panel de Administración</p>
        </div>
        <form className={styles.login__form} onSubmit={handleSubmit}>
          <div className={styles.login__field}>
            <label htmlFor="username">Usuario</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className={styles.login__field}>
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className={styles.login__error}>{error}</p>}
          <button type="submit" className={styles.login__submit} disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}


