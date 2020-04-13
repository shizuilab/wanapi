#!usr/bin/python3
# -*- coding: utf-8 -*-

import smbus
import time
import subprocess
import ipget
from pythonosc import osc_server
from pythonosc.dispatcher import Dispatcher
import RPi.GPIO as GPIO

i2c = smbus.SMBus(1) # 1 is bus number
addr02=0x3e #lcd
_command=0x00
_data=0x40
_clear=0x01
_home=0x02
display_On=0x0f
LCD_2ndline=0x40+0x80

GPIO.setmode(GPIO.BOARD)
GPIO.setup(7, GPIO.OUT) #pin7 = GPIO4

#LCD AQM0802/1602
def command( code ):
        i2c.write_byte_data(addr02, _command, code)
        time.sleep(0.1)

def writeLCD( message ):
        mojilist=[]
        for moji in message:
                mojilist.append(ord(moji))
        i2c.write_i2c_block_data(addr02, _data, mojilist)
        time.sleep(0.1)

def init ():
        command(0x38)
        command(0x39)
        command(0x14)
        command(0x73)
        command(0x56)
        command(0x6c)
        command(0x38)
        command(_clear)
        command(display_On)

def display_handler(unused_addr, msg):
        command(_clear)
        mojilist=[]
        for moji in msg[0:8]:
                mojilist.append(ord(moji))
        i2c.write_i2c_block_data(addr02, _data, mojilist)
        command(LCD_2ndline)
        mojilist=[]
        for moji in msg[8:16]:
                mojilist.append(ord(moji))
        i2c.write_i2c_block_data(addr02, _data, mojilist)
        time.sleep(0.1)

#main
init ()
command(_clear)

#IPアドレスを表示してバックライトをオン
ip = ipget.ipget()
ip_addr = ip.ipaddr('wlan0')
display_handler(0, ip_addr)
print(ip_addr)
GPIO.output(7, 1)
time.sleep(0.5)

ip = '127.0.0.1'
port = 5005

dispatcher = Dispatcher()
dispatcher.map('/change_msg', display_handler)
server = osc_server.ThreadingOSCUDPServer((ip, port), dispatcher)
server.serve_forever()
