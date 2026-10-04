from os import *
from random import *
from time import *
from minesweeper.functions import *

starttime=time()
board=getBoard()
level=board[0]
width=board[1]
height=board[2]
mines=board[3]
initialouter=geninit(width,height)
printOuter(initialouter)
initialCoordinates=getCoor(width,height)
x=initialCoordinates[0]
y=initialCoordinates[1]
minelocs=mineloc(width,height,mines,x,y)

#inner=innerarray(width,height,minelocs)
innerinitial=genintinit(width,height)
mainout=(outerarray(width,height,initialouter,innerinitial,x,y,0,minelocs,0))
status=mainout[0]
innerfinal=mainout[2]
#print("end="+str(status))
end(status,innerfinal,starttime)
