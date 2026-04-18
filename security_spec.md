# Especificación de Seguridad de Firestore - Sistema de Turnos

## 1. Invariantes de Datos
*   **Capacidad de Tarde**: Ningún cuadrante puede ser guardado si algún día tiene más de 2 personas asignadas al turno de tarde (T) sin ser marcadas como exentas.
*   **Capacidad de Mañana**: Límite de 3 (L-J) y 4 (V-D) mañanas asignadas.
*   **Integridad de Empleados**: Los empleados deben tener un nombre, rol válido y campos de control de capacidad.
*   **Identidad**: Solo usuarios autenticados pueden leer o escribir datos.

## 2. Los "Doce Sucios" (Payloads de Ataque)
1.  **Suplantación de Identidad**: Intentar crear un empleado con un ID ajeno.
2.  **Inyección de ID**: Usar un ID de 2MB para bloquear el sistema.
3.  **Exceso de Tarde**: Guardar un cuadrante con 10 personas en el turno 'T'.
4.  **Omisión de Estado**: Intentar borrar la configuración global para dejar el sistema sin límites.
5.  **Escalada de Privilegios**: Intentar marcarse a sí mismo como exento de capacidad sin ser admin.
6.  **Borrado Masivo**: Intentar borrar la colección de empleados.
7.  **Escritura Fantasma**: Añadir campos extraños (`{Hacker: true}`) a los documentos de empleados.
8.  **Fecha Inválida**: Guardar peticiones de vacaciones con fechas del año 3000 o formato incorrecto.
9.  **Cuadrante Huérfano**: Guardar turnos para empleados que no existen en la colección `employees`.
10. **Manipulación de Contador**: Cambiar el `workDaysCount` de un empleado manualmente a -1.
11. **Turno Inexistente**: Asignar un código de turno 'X' que no está definido en `shiftTypes`.
12. **Lectura de Scraping**: Intentar listar todos los cuadrantes de semanas pasadas sin especificar filtros.

## 3. Plan de Pruebas
Se creará un archivo de reglas que valide:
*   Tipos de datos estrictos para cada colección.
*   Límites de tamaño en strings (IDs, nombres).
*   Validación de llaves afectadas en actualizaciones.
