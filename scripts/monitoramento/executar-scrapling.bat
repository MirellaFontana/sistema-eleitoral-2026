@echo off
REM Monitoramento Scrapling — agendar no Agendador de Tarefas do Windows
REM Recomendado: a cada 3-6 horas
REM
REM Para agendar:
REM   1. Abra o Agendador de Tarefas (taskschd.msc)
REM   2. Criar Tarefa Basica > Nome: "Monitoramento Scrapling"
REM   3. Disparador: Diariamente, repetir a cada 3 horas
REM   4. Acao: Iniciar programa > este arquivo .bat
REM   5. Marcar "Executar estando o usuario conectado ou nao"

cd /d "%~dp0"
python scraper.py >> scrapling.log 2>&1
