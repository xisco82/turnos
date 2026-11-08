# Turnos de recepción

Generador automático de cuadrantes semanales con normas activables.

## Arrancar

1. `npm install`
2. `npm run dev` y abre http://localhost:3000

- **Panel del administrador:** dirección principal. Sin contraseña por ahora. Cuando quieras, pon un PIN en Ajustes → Seguridad para que los empleados no puedan entrar al panel.
- **Empleados:** `http://TU-DIRECCION/?portal=empleado`. Ven su cuadrante y piden días. Nunca ven roles ni ajustes.

## Cómo funciona

- El conserje de noche trabaja sus 5 noches. Sus días libres los cubre cada semana una recepcionista distinta de la rotación de noches.
- Al salir de noche, cada empleado tiene su opción: tarde al día siguiente o 2 días libres.
- Cada semana libra sábado y domingo una persona distinta.
- Todos trabajan 5 días y libran 2 seguidos.
- Por la tarde nunca hay dos ayudantes juntos y siempre hay un recepcionista.
- Personal por día, horarios, roles, empleados y cada norma se cambian en **Ajustes**.
- El turno especial (10:00–18:00 por defecto) se activa en Ajustes → Personal por día.
- Si cambias una casilla a mano, el resto del cuadrante se reorganiza solo.
- Encima del cuadrante aparece si cumple todas las normas o qué falla exactamente.

## Archivos principales

- `scheduleService.ts`: motor de generación y validación.
- `components/SetupForm.tsx`: ajustes.
- `components/EmployeePortal.tsx`: portal del empleado.
- `server.ts`: guarda los datos en `data/` y protege la configuración con el PIN.
